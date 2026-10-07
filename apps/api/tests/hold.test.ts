import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/db';
import { signToken } from '../src/middleware/auth';
import { Role } from '@prisma/client';

describe('Seat Hold Concurrency & Rules', () => {
  let eventId: string;
  let eventSeats: Array<{ id: string; seatId: string }>;

  beforeAll(async () => {
    // Find published event and available seats
    const event = await prisma.event.findFirst({
      where: { status: 'PUBLISHED' },
      include: {
        eventSeats: {
          take: 10,
          orderBy: { id: 'asc' },
        },
      },
    });

    if (!event || event.eventSeats.length < 5) {
      throw new Error('Test requires seeded event with at least 5 seats');
    }

    eventId = event.id;
    eventSeats = event.eventSeats.map((es) => ({ id: es.id, seatId: es.seatId }));

    // Reset test seats to AVAILABLE
    await prisma.eventSeat.updateMany({
      where: { id: { in: eventSeats.map((s) => s.id) } },
      data: {
        status: 'AVAILABLE',
        heldByUserId: null,
        holdExpiresAt: null,
      },
    });
  });

  afterAll(async () => {
    // Reset seats after tests
    if (eventSeats && eventSeats.length > 0) {
      await prisma.eventSeat.updateMany({
        where: { id: { in: eventSeats.map((s) => s.id) } },
        data: {
          status: 'AVAILABLE',
          heldByUserId: null,
          holdExpiresAt: null,
        },
      });
    }
  });

  it('50 parallel hold requests for the same seat: exactly ONE succeeds, 49 fail with 409', async () => {
    const targetSeat = eventSeats[0];

    // Ensure seat is available before test
    await prisma.eventSeat.update({
      where: { id: targetSeat.id },
      data: { status: 'AVAILABLE', heldByUserId: null, holdExpiresAt: null },
    });

    // Create 50 distinct test users in database
    const userPromises = Array.from({ length: 50 }, (_, i) =>
      prisma.user.upsert({
        where: { email: `racer_${i}@test.com` },
        update: {},
        create: {
          email: `racer_${i}@test.com`,
          passwordHash: 'dummyhash',
          role: Role.CUSTOMER,
        },
      })
    );
    const users = await Promise.all(userPromises);

    // Clean any prior holds for these test users
    await prisma.eventSeat.updateMany({
      where: { heldByUserId: { in: users.map((u) => u.id) } },
      data: { status: 'AVAILABLE', heldByUserId: null, holdExpiresAt: null },
    });

    // Fire 50 concurrent requests simultaneously using Promise.all
    const holdPromises = users.map((user) => {
      const token = signToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      return request(app)
        .post(`/api/events/${eventId}/hold`)
        .set('Cookie', [`token=${token}`])
        .send({ seatIds: [targetSeat.seatId] });
    });

    const responses = await Promise.all(holdPromises);

    const successResponses = responses.filter((r) => r.status === 200);
    const conflictResponses = responses.filter((r) => r.status === 409);

    expect(successResponses.length).toBe(1);
    expect(conflictResponses.length).toBe(49);

    // Verify database state: seat is HELD by the winner
    const winnerUserId = successResponses[0].body.heldSeats[0]?.heldByUserId;
    const dbSeat = await prisma.eventSeat.findUnique({
      where: { id: targetSeat.id },
    });

    expect(dbSeat?.status).toBe('HELD');
    expect(dbSeat?.heldByUserId).toBeDefined();
    if (winnerUserId) {
      expect(dbSeat?.heldByUserId).toBe(winnerUserId);
    }
  });

  it('overlapping multi-seat requests ([S1, S2] vs [S2, S3]) are atomic and do not deadlock', async () => {
    const s1 = eventSeats[1];
    const s2 = eventSeats[2];
    const s3 = eventSeats[3];

    // Reset S1, S2, S3
    await prisma.eventSeat.updateMany({
      where: { id: { in: [s1.id, s2.id, s3.id] } },
      data: { status: 'AVAILABLE', heldByUserId: null, holdExpiresAt: null },
    });

    const userA = await prisma.user.upsert({
      where: { email: 'overlap_a@test.com' },
      update: {},
      create: { email: 'overlap_a@test.com', passwordHash: 'hash', role: Role.CUSTOMER },
    });

    const userB = await prisma.user.upsert({
      where: { email: 'overlap_b@test.com' },
      update: {},
      create: { email: 'overlap_b@test.com', passwordHash: 'hash', role: Role.CUSTOMER },
    });

    const tokenA = signToken({ userId: userA.id, email: userA.email, role: userA.role });
    const tokenB = signToken({ userId: userB.id, email: userB.email, role: userB.role });

    // User A requests [S1, S2], User B requests [S2, S3] concurrently
    const [resA, resB] = await Promise.all([
      request(app)
        .post(`/api/events/${eventId}/hold`)
        .set('Cookie', [`token=${tokenA}`])
        .send({ seatIds: [s1.seatId, s2.seatId] }),
      request(app)
        .post(`/api/events/${eventId}/hold`)
        .set('Cookie', [`token=${tokenB}`])
        .send({ seatIds: [s2.seatId, s3.seatId] }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    // Exactly one must succeed (200) and one must fail (409)
    expect(statuses).toEqual([200, 409]);

    // Ensure all-or-nothing: the loser got 0 seats (no partial hold of unshared seat!)
    const loserRes = resA.status === 409 ? resA : resB;
    const winnerUser = resA.status === 200 ? userA : userB;
    const loserUser = resA.status === 409 ? userA : userB;

    const loserHeldSeats = await prisma.eventSeat.findMany({
      where: { eventId, heldByUserId: loserUser.id, status: 'HELD' },
    });
    expect(loserHeldSeats.length).toBe(0);

    const winnerHeldSeats = await prisma.eventSeat.findMany({
      where: { eventId, heldByUserId: winnerUser.id, status: 'HELD' },
    });
    expect(winnerHeldSeats.length).toBe(2);
  });

  it('expired holds count as available in the hold query', async () => {
    const targetSeat = eventSeats[4];
    const oldUser = await prisma.user.upsert({
      where: { email: 'old_holder@test.com' },
      update: {},
      create: { email: 'old_holder@test.com', passwordHash: 'hash', role: Role.CUSTOMER },
    });

    // Seed seat as HELD in the past (expired 2 minutes ago)
    await prisma.eventSeat.update({
      where: { id: targetSeat.id },
      data: {
        status: 'HELD',
        heldByUserId: oldUser.id,
        holdExpiresAt: new Date(Date.now() - 2 * 60 * 1000),
      },
    });

    const newUser = await prisma.user.upsert({
      where: { email: 'expiry_buyer@test.com' },
      update: {},
      create: { email: 'expiry_buyer@test.com', passwordHash: 'hash', role: Role.CUSTOMER },
    });

    const token = signToken({ userId: newUser.id, email: newUser.email, role: newUser.role });

    const res = await request(app)
      .post(`/api/events/${eventId}/hold`)
      .set('Cookie', [`token=${token}`])
      .send({ seatIds: [targetSeat.seatId] });

    expect(res.status).toBe(200);
    expect(res.body.heldSeats.length).toBe(1);

    const updated = await prisma.eventSeat.findUnique({
      where: { id: targetSeat.id },
    });
    expect(updated?.heldByUserId).toBe(newUser.id);
    expect(updated?.status).toBe('HELD');
  });

  it('enforces one active hold per user per event', async () => {
    const s1 = eventSeats[5];
    const s2 = eventSeats[6];

    await prisma.eventSeat.updateMany({
      where: { id: { in: [s1.id, s2.id] } },
      data: { status: 'AVAILABLE', heldByUserId: null, holdExpiresAt: null },
    });

    const user = await prisma.user.upsert({
      where: { email: 'single_hold_user@test.com' },
      update: {},
      create: { email: 'single_hold_user@test.com', passwordHash: 'hash', role: Role.CUSTOMER },
    });

    const token = signToken({ userId: user.id, email: user.email, role: user.role });

    // First hold succeeds
    const res1 = await request(app)
      .post(`/api/events/${eventId}/hold`)
      .set('Cookie', [`token=${token}`])
      .send({ seatIds: [s1.seatId] });
    expect(res1.status).toBe(200);

    // Second hold for different seat should be rejected
    const res2 = await request(app)
      .post(`/api/events/${eventId}/hold`)
      .set('Cookie', [`token=${token}`])
      .send({ seatIds: [s2.seatId] });
    expect(res2.status).toBe(400);
    expect(res2.body.error).toContain('already have an active seat hold');
  });

  it('can release a held seat', async () => {
    const seat = eventSeats[7];

    const user = await prisma.user.upsert({
      where: { email: 'releaser@test.com' },
      update: {},
      create: { email: 'releaser@test.com', passwordHash: 'hash', role: Role.CUSTOMER },
    });

    const token = signToken({ userId: user.id, email: user.email, role: user.role });

    // Hold seat
    await request(app)
      .post(`/api/events/${eventId}/hold`)
      .set('Cookie', [`token=${token}`])
      .send({ seatIds: [seat.seatId] });

    // Release seat
    const releaseRes = await request(app)
      .post(`/api/events/${eventId}/release`)
      .set('Cookie', [`token=${token}`])
      .send({ seatIds: [seat.seatId] });

    expect(releaseRes.status).toBe(200);
    expect(releaseRes.body.releasedCount).toBe(1);

    const dbSeat = await prisma.eventSeat.findUnique({ where: { id: seat.id } });
    expect(dbSeat?.status).toBe('AVAILABLE');
    expect(dbSeat?.heldByUserId).toBeNull();
  });
});
