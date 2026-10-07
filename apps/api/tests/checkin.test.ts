import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/db';
import { signToken } from '../src/middleware/auth';
import { Role } from '@prisma/client';

describe('Staff Ticket Check-in & Concurrency', () => {
  let staffToken: string;
  let customerToken: string;
  let testTicket: { id: string; qrToken: string };

  beforeAll(async () => {
    // 1. Setup staff and customer users
    const staff = await prisma.user.upsert({
      where: { email: 'staff_tester@test.com' },
      update: {},
      create: { email: 'staff_tester@test.com', passwordHash: 'hash', role: Role.STAFF },
    });
    staffToken = signToken({ userId: staff.id, email: staff.email, role: staff.role });

    const customer = await prisma.user.upsert({
      where: { email: 'customer_gate_test@test.com' },
      update: {},
      create: { email: 'customer_gate_test@test.com', passwordHash: 'hash', role: Role.CUSTOMER },
    });
    customerToken = signToken({ userId: customer.id, email: customer.email, role: customer.role });

    // 2. Find published event and available seat to create test ticket
    const event = await prisma.event.findFirst({
      where: { status: 'PUBLISHED' },
      include: { eventSeats: { take: 2 } },
    });
    if (!event || event.eventSeats.length === 0) {
      throw new Error('Test event not found');
    }

    const eventSeat = event.eventSeats[0];

    // Create test order & ticket
    const order = await prisma.order.create({
      data: {
        userId: customer.id,
        eventId: event.id,
        status: 'CONFIRMED',
        totalCents: eventSeat.price,
      },
    });

    // Mark seat SOLD
    await prisma.eventSeat.update({
      where: { id: eventSeat.id },
      data: { status: 'SOLD', heldByUserId: null, holdExpiresAt: null },
    });

    // Delete any existing ticket on this seat
    await prisma.ticket.deleteMany({ where: { eventSeatId: eventSeat.id } });

    const ticket = await prisma.ticket.create({
      data: {
        orderId: order.id,
        eventSeatId: eventSeat.id,
        qrToken: crypto.randomUUID(),
        checkedInAt: null,
      },
    });

    testTicket = { id: ticket.id, qrToken: ticket.qrToken };
  });

  afterAll(async () => {
    if (testTicket) {
      await prisma.ticket.deleteMany({ where: { id: testTicket.id } });
    }
  });

  it('valid ticket: staff successfully checks in attendee', async () => {
    const res = await request(app)
      .post('/api/tickets/check-in')
      .set('Cookie', [`token=${staffToken}`])
      .send({ qrToken: testTicket.qrToken });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Check-in successful');
    expect(res.body.checkedInAt).toBeDefined();
    expect(res.body.attendee.email).toBe('customer_gate_test@test.com');

    // Verify database row
    const dbTicket = await prisma.ticket.findUnique({
      where: { id: testTicket.id },
    });
    expect(dbTicket?.checkedInAt).not.toBeNull();
  });

  it('second scan: returns 409 with "Ticket already used"', async () => {
    const res = await request(app)
      .post('/api/tickets/check-in')
      .set('Cookie', [`token=${staffToken}`])
      .send({ qrToken: testTicket.qrToken });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('already used');
    expect(res.body.checkedInAt).toBeDefined();
  });

  it('concurrent scans: only one succeeds, second gets already used', async () => {
    // Create a fresh unchecked ticket for concurrent test
    const event = await prisma.event.findFirst({
      where: { status: 'PUBLISHED' },
      include: { eventSeats: { skip: 1, take: 1 } },
    });
    const eventSeat = event!.eventSeats[0];

    const customer = await prisma.user.findUnique({ where: { email: 'customer_gate_test@test.com' } });

    const order = await prisma.order.create({
      data: {
        userId: customer!.id,
        eventId: event!.id,
        status: 'CONFIRMED',
        totalCents: eventSeat.price,
      },
    });

    await prisma.ticket.deleteMany({ where: { eventSeatId: eventSeat.id } });
    const freshTicket = await prisma.ticket.create({
      data: {
        orderId: order.id,
        eventSeatId: eventSeat.id,
        qrToken: crypto.randomUUID(),
        checkedInAt: null,
      },
    });

    // 2 parallel scans for the same fresh ticket
    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/tickets/check-in')
        .set('Cookie', [`token=${staffToken}`])
        .send({ qrToken: freshTicket.qrToken }),
      request(app)
        .post('/api/tickets/check-in')
        .set('Cookie', [`token=${staffToken}`])
        .send({ qrToken: freshTicket.qrToken }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 409]);

    // Cleanup
    await prisma.ticket.deleteMany({ where: { id: freshTicket.id } });
    await prisma.order.deleteMany({ where: { id: order.id } });
  });

  it('invalid token: returns 404', async () => {
    const res = await request(app)
      .post('/api/tickets/check-in')
      .set('Cookie', [`token=${staffToken}`])
      .send({ qrToken: crypto.randomUUID() });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Invalid ticket');
  });

  it('customer role cannot check in tickets (403 Forbidden)', async () => {
    const res = await request(app)
      .post('/api/tickets/check-in')
      .set('Cookie', [`token=${customerToken}`])
      .send({ qrToken: testTicket.qrToken });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Permission denied');
  });
});
