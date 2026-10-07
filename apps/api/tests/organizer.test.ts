import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/db';
import { signToken } from '../src/middleware/auth';
import { Role } from '@prisma/client';

describe('Organizer Dashboard & Stats API', () => {
  let organizerToken: string;
  let customerToken: string;
  let eventId: string;

  beforeAll(async () => {
    // 1. Ensure organizer and customer exist
    const organizer = await prisma.user.upsert({
      where: { email: 'organizer_tester@test.com' },
      update: {},
      create: { email: 'organizer_tester@test.com', passwordHash: 'hash', role: Role.ORGANIZER },
    });
    organizerToken = signToken({ userId: organizer.id, email: organizer.email, role: organizer.role });

    const customer = await prisma.user.upsert({
      where: { email: 'customer_dash_tester@test.com' },
      update: {},
      create: { email: 'customer_dash_tester@test.com', passwordHash: 'hash', role: Role.CUSTOMER },
    });
    customerToken = signToken({ userId: customer.id, email: customer.email, role: customer.role });

    const event = await prisma.event.findFirst({
      where: { status: 'PUBLISHED' },
    });
    if (!event) throw new Error('No published event found for tests');
    eventId = event.id;
  });

  it('rejects regular customer from accessing organizer stats with 403', async () => {
    const res = await request(app)
      .get('/api/organizer/stats')
      .set('Cookie', [`token=${customerToken}`]);

    expect(res.status).toBe(403);
  });

  it('allows organizer to fetch aggregate dashboard stats with 200', async () => {
    const res = await request(app)
      .get('/api/organizer/stats')
      .set('Cookie', [`token=${organizerToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.totalEvents).toBeGreaterThan(0);
    expect(typeof res.body.summary.overallOccupancyRate).toBe('number');
    expect(Array.isArray(res.body.events)).toBe(true);
    expect(res.body.events.length).toBeGreaterThan(0);
    expect(res.body.events[0]).toHaveProperty('occupancyRate');
    expect(res.body.events[0]).toHaveProperty('revenueCents');
  });

  it('allows organizer to fetch detailed event stats with 200', async () => {
    const res = await request(app)
      .get(`/api/organizer/events/${eventId}/stats`)
      .set('Cookie', [`token=${organizerToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.event.id).toBe(eventId);
    expect(res.body.overview).toBeDefined();
    expect(res.body.overview.totalSeats).toBeGreaterThan(0);
    expect(Array.isArray(res.body.tiers)).toBe(true);
    expect(res.body.checkIn).toBeDefined();
    expect(typeof res.body.checkIn.checkInRate).toBe('number');
  });

  it('returns 404 for non-existent event stats', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .get(`/api/organizer/events/${fakeId}/stats`)
      .set('Cookie', [`token=${organizerToken}`]);

    expect(res.status).toBe(404);
  });
});
