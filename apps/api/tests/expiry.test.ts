import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/db';
import { holdSeats } from '../src/services/hold.service';
import { cleanupExpiredHolds } from '../src/jobs/cleanup.job';
import { Role } from '@prisma/client';

describe('Hold Expiry and Cleanup', () => {
  let eventId: string;
  let seatId: string;
  let userId: string;

  beforeAll(async () => {
    const event = await prisma.event.findFirst({
      where: { status: 'PUBLISHED' },
      include: { eventSeats: { take: 1 } },
    });

    if (!event || event.eventSeats.length === 0) {
      throw new Error('Test event not found');
    }

    eventId = event.id;
    seatId = event.eventSeats[0].seatId;

    // Reset seat to AVAILABLE
    await prisma.eventSeat.updateMany({
      where: { eventId, seatId },
      data: { status: 'AVAILABLE', heldByUserId: null, holdExpiresAt: null },
    });

    const user = await prisma.user.upsert({
      where: { email: 'expiry_tester@test.com' },
      update: {},
      create: { email: 'expiry_tester@test.com', passwordHash: 'hash', role: Role.CUSTOMER },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.eventSeat.updateMany({
      where: { eventId, seatId },
      data: { status: 'AVAILABLE', heldByUserId: null, holdExpiresAt: null },
    });
  });

  it('cleanup job resets stray expired holds back to AVAILABLE', async () => {
    // 1. Hold seat
    await holdSeats({
      eventId,
      seatIds: [seatId],
      userId,
    });

    const heldSeat = await prisma.eventSeat.findFirst({
      where: { eventId, seatId },
    });
    expect(heldSeat?.status).toBe('HELD');
    expect(heldSeat?.heldByUserId).toBe(userId);

    // 2. Fast-forward expiration into the past
    await prisma.eventSeat.update({
      where: { id: heldSeat!.id },
      data: { holdExpiresAt: new Date(Date.now() - 5000) },
    });

    // 3. Run cleanup job
    const releasedCount = await cleanupExpiredHolds();
    expect(releasedCount).toBeGreaterThanOrEqual(1);

    // 4. Assert seat is back to AVAILABLE
    const cleanedSeat = await prisma.eventSeat.findFirst({
      where: { eventId, seatId },
    });
    expect(cleanedSeat?.status).toBe('AVAILABLE');
    expect(cleanedSeat?.heldByUserId).toBeNull();
    expect(cleanedSeat?.holdExpiresAt).toBeNull();
  });
});
