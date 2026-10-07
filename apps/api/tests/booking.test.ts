import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/db';
import { signToken } from '../src/middleware/auth';
import { Role } from '@prisma/client';

describe('Booking Confirmation, Idempotency & Tickets', () => {
  let eventId: string;
  let testSeats: Array<{ id: string; seatId: string }>;
  let userId: string;
  let token: string;

  beforeAll(async () => {
    const event = await prisma.event.findFirst({
      where: { status: 'PUBLISHED' },
      include: { eventSeats: { take: 4 } },
    });

    if (!event || event.eventSeats.length < 4) {
      throw new Error('Test requires event with at least 4 seats');
    }

    eventId = event.id;
    testSeats = event.eventSeats.map((s) => ({ id: s.id, seatId: s.seatId }));

    // Reset test seats to AVAILABLE
    await prisma.eventSeat.updateMany({
      where: { id: { in: testSeats.map((s) => s.id) } },
      data: { status: 'AVAILABLE', heldByUserId: null, holdExpiresAt: null },
    });

    const user = await prisma.user.upsert({
      where: { email: 'confirm_tester@test.com' },
      update: {},
      create: { email: 'confirm_tester@test.com', passwordHash: 'hash', role: Role.CUSTOMER },
    });
    userId = user.id;
    token = signToken({ userId: user.id, email: user.email, role: user.role });

    // Clean any prior orders from previous test runs
    await prisma.order.deleteMany({ where: { userId: user.id } });
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { userId } });
    await prisma.eventSeat.updateMany({
      where: { id: { in: testSeats.map((s) => s.id) } },
      data: { status: 'AVAILABLE', heldByUserId: null, holdExpiresAt: null },
    });
  });

  it('confirms held seats, creates tickets with QR tokens, and marks seats SOLD', async () => {
    const s1 = testSeats[0];
    const s2 = testSeats[1];

    // 1. Hold seats first
    const holdRes = await request(app)
      .post(`/api/events/${eventId}/hold`)
      .set('Cookie', [`token=${token}`])
      .send({ seatIds: [s1.seatId, s2.seatId] });
    expect(holdRes.status).toBe(200);

    // 2. Confirm booking
    const idempotencyKey = 'key_confirm_test_123';
    const confirmRes = await request(app)
      .post('/api/orders/confirm')
      .set('Cookie', [`token=${token}`])
      .send({
        eventId,
        seatIds: [s1.seatId, s2.seatId],
        idempotencyKey,
      });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.order.status).toBe('CONFIRMED');
    expect(confirmRes.body.tickets.length).toBe(2);
    expect(confirmRes.body.tickets[0].qrToken).toBeDefined();
    expect(confirmRes.body.tickets[0].qrDataUrl).toContain('data:image/png;base64');

    // 3. Verify database state
    const dbSeats = await prisma.eventSeat.findMany({
      where: { id: { in: [s1.id, s2.id] } },
    });
    expect(dbSeats.every((s) => s.status === 'SOLD')).toBe(true);

    const dbTickets = await prisma.ticket.findMany({
      where: { orderId: confirmRes.body.order.id },
    });
    expect(dbTickets.length).toBe(2);
  });

  it('idempotency: double confirm with same key returns identical order without duplicates', async () => {
    const idempotencyKey = 'key_confirm_test_123';
    const s1 = testSeats[0];
    const s2 = testSeats[1];

    // Second call with same idempotencyKey
    const secondRes = await request(app)
      .post('/api/orders/confirm')
      .set('Cookie', [`token=${token}`])
      .send({
        eventId,
        seatIds: [s1.seatId, s2.seatId],
        idempotencyKey,
      });

    expect(secondRes.status).toBe(200);
    expect(secondRes.body.order.status).toBe('CONFIRMED');
    expect(secondRes.body.tickets.length).toBe(2);

    // Verify tickets count in DB did NOT increase
    const count = await prisma.ticket.count({
      where: { orderId: secondRes.body.order.id },
    });
    expect(count).toBe(2);
  });

  it('fails with 400 if user tries to confirm seats without an active hold', async () => {
    const s3 = testSeats[2];

    // s3 is currently AVAILABLE (not held)
    const res = await request(app)
      .post('/api/orders/confirm')
      .set('Cookie', [`token=${token}`])
      .send({
        eventId,
        seatIds: [s3.seatId],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('actively held by you');
  });

  it('GET /api/orders/my-tickets returns confirmed tickets with QR codes', async () => {
    const res = await request(app)
      .get('/api/orders/my-tickets')
      .set('Cookie', [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.orders.length).toBeGreaterThanOrEqual(1);
    expect(res.body.orders[0].tickets[0].qrDataUrl).toBeDefined();
  });
});
