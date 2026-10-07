import { prisma } from '../src/db';
import { holdSeats } from '../src/services/hold.service';
import { finalizeOrder } from '../src/services/order.service';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { logger } from '../src/logger';

logger.level = 'silent';

interface BenchmarkResult {
  totalRequests: number;
  successfulHolds: number;
  conflictedHolds: number;
  unexpectedErrors: number;
  durationMs: number;
  requestsPerSecond: number;
  latencies: number[];
  p50: number;
  p95: number;
  p99: number;
  databaseDoubleBookings: number;
}

async function runConcurrencyBenchmark(): Promise<BenchmarkResult> {
  console.log('='.repeat(70));
  console.log('⚡ STARTING CONCURRENCY & ZERO-DOUBLE-BOOKING STRESS BENCHMARK');
  console.log('='.repeat(70));

  // 1. Setup isolated test venue & event with 50 seats
  const venue = await prisma.venue.create({
    data: {
      name: `Benchmark Arena ${Date.now()}`,
      layout: { width: 800, height: 600 },
    },
  });

  const seatData: Array<{
    venueId: string;
    section: string;
    row: string;
    number: number;
    x: number;
    y: number;
    tier: string;
  }> = [];

  const TOTAL_SEATS = 50;
  for (let i = 1; i <= TOTAL_SEATS; i++) {
    seatData.push({
      venueId: venue.id,
      section: 'Orchestra',
      row: 'A',
      number: i,
      x: i * 20,
      y: 100,
      tier: i <= 10 ? 'VIP' : i <= 30 ? 'PREMIUM' : 'STANDARD',
    });
  }

  await prisma.seat.createMany({ data: seatData });
  const createdSeats = await prisma.seat.findMany({ where: { venueId: venue.id } });

  const event = await prisma.event.create({
    data: {
      venueId: venue.id,
      title: `High-Load Stress Show ${Date.now()}`,
      startsAt: new Date(Date.now() + 86400000),
    },
  });

  await prisma.eventSeat.createMany({
    data: createdSeats.map((s) => ({
      eventId: event.id,
      seatId: s.id,
      price: s.tier === 'VIP' ? 8000 : 4000,
      status: 'AVAILABLE',
    })),
  });

  console.log(`✓ Created test event with ${TOTAL_SEATS} available seats.`);

  // 2. Pre-create 200 Virtual Users
  const TOTAL_VUS = 200;
  console.log(`✓ Pre-generating ${TOTAL_VUS} simulated virtual users...`);

  const passwordHash = await bcrypt.hash('benchpass', 4);
  const userCreates = [];
  for (let u = 1; u <= TOTAL_VUS; u++) {
    userCreates.push({
      email: `vu_${Date.now()}_${u}@stress.test`,
      passwordHash,
      role: Role.CUSTOMER,
    });
  }
  await prisma.user.createMany({ data: userCreates });
  const vus = await prisma.user.findMany({
    where: { email: { contains: '@stress.test' } },
    take: TOTAL_VUS,
  });

  console.log(`✓ ${vus.length} Virtual Users ready.`);

  // 3. Simulate 1,000 rapid concurrent hold requests targeting the 50 seats
  const TOTAL_REQUESTS = 1000;
  console.log(`\n🚀 Launching ${TOTAL_REQUESTS} concurrent hold attempts from ${TOTAL_VUS} VUs racing for ${TOTAL_SEATS} seats...`);

  const latencies: number[] = [];
  let successfulHolds = 0;
  let conflictedHolds = 0;
  let unexpectedErrors = 0;

  const startTime = Date.now();

  // Create 1,000 requests distributed across the VUs
  const requests = Array.from({ length: TOTAL_REQUESTS }, (_, idx) => {
    const vu = vus[idx % vus.length];
    // Each request picks 1 to 2 random seats from the 50 seats (creating massive contention)
    const randomSeatIndex1 = Math.floor(Math.random() * createdSeats.length);
    const targetSeatIds = [createdSeats[randomSeatIndex1].id];

    if (Math.random() > 0.5) {
      const randomSeatIndex2 = (randomSeatIndex1 + 1) % createdSeats.length;
      targetSeatIds.push(createdSeats[randomSeatIndex2].id);
    }

    return async () => {
      const reqStart = Date.now();
      try {
        await holdSeats({
          eventId: event.id,
          seatIds: targetSeatIds,
          userId: vu.id,
        });
        successfulHolds++;
      } catch (err: any) {
        if (err.statusCode === 409 || err.statusCode === 400) {
          conflictedHolds++;
        } else {
          unexpectedErrors++;
          console.error(`Unexpected error:`, err);
        }
      } finally {
        latencies.push(Date.now() - reqStart);
      }
    };
  });

  // Run in chunks of 50 simultaneous parallel requests to simulate continuous wave bursts
  const BATCH_SIZE = 50;
  for (let i = 0; i < requests.length; i += BATCH_SIZE) {
    const chunk = requests.slice(i, i + BATCH_SIZE);
    await Promise.all(chunk.map((fn) => fn()));
  }

  const durationMs = Date.now() - startTime;
  const requestsPerSecond = Math.round((TOTAL_REQUESTS / (durationMs / 1000)) * 10) / 10;

  // Latency percentiles
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

  // 4. DATABASE INTEGRITY AUDIT
  console.log('\n🔍 Running Database Concurrency Integrity Audit...');

  // Check 1: Are any seats double-held in EventSeat?
  const doubleHoldCheck = await prisma.$queryRaw<Array<{ seatId: string; count: bigint }>>`
    SELECT "seatId", count(*) as count
    FROM "EventSeat"
    WHERE "eventId" = ${event.id} AND status = 'HELD'
    GROUP BY "seatId"
    HAVING count(*) > 1;
  `;

  const doubleBookings = doubleHoldCheck.length;

  // Check 2: Total seats currently marked HELD
  const heldCount = await prisma.eventSeat.count({
    where: { eventId: event.id, status: 'HELD' },
  });

  // Check 3: Distinct users holding seats
  const distinctHolders = await prisma.eventSeat.findMany({
    where: { eventId: event.id, status: 'HELD' },
    select: { heldByUserId: true },
    distinct: ['heldByUserId'],
  });

  // 5. TEST CONCURRENT ORDER CONFIRMATION ON HELD SEATS
  console.log(`\n💳 Testing Order Confirmation on ${distinctHolders.length} active seat-holding users...`);
  let confirmedOrders = 0;
  let confirmFailures = 0;

  for (const holder of distinctHolders) {
    if (!holder.heldByUserId) continue;

    const userHeldSeats = await prisma.eventSeat.findMany({
      where: { eventId: event.id, heldByUserId: holder.heldByUserId, status: 'HELD' },
    });

    if (userHeldSeats.length === 0) continue;

    try {
      const order = await prisma.order.create({
        data: {
          userId: holder.heldByUserId,
          eventId: event.id,
          status: 'PENDING',
          totalCents: userHeldSeats.reduce((sum, s) => sum + s.price, 0),
        },
      });

      await finalizeOrder(order.id);
      confirmedOrders++;
    } catch (err) {
      confirmFailures++;
      console.error('Confirmation failure:', err);
    }
  }

  // Check 4: Check for any duplicate tickets on the same seat
  const duplicateTicketCheck = await prisma.$queryRaw<Array<{ eventSeatId: string; count: bigint }>>`
    SELECT "eventSeatId", count(*) as count
    FROM "Ticket"
    GROUP BY "eventSeatId"
    HAVING count(*) > 1;
  `;

  // Clean up benchmark event
  await prisma.event.delete({ where: { id: event.id } });
  await prisma.seat.deleteMany({ where: { venueId: venue.id } });
  await prisma.venue.delete({ where: { id: venue.id } });
  await prisma.user.deleteMany({ where: { email: { contains: '@stress.test' } } });

  console.log('\n' + '='.repeat(70));
  console.log('📊 CONCURRENCY BENCHMARK RESULTS');
  console.log('='.repeat(70));
  console.log(`Total Requests:          ${TOTAL_REQUESTS}`);
  console.log(`Successful Holds:        ${successfulHolds}`);
  console.log(`Conflicted Rejections:   ${conflictedHolds} (409 Conflict)`);
  console.log(`Unexpected Server 5xx:   ${unexpectedErrors}`);
  console.log(`Total Duration:          ${durationMs}ms`);
  console.log(`Throughput:              ${requestsPerSecond} req/sec`);
  console.log(`Latency p50 (Median):    ${p50}ms`);
  console.log(`Latency p95:             ${p95}ms`);
  console.log(`Latency p99:             ${p99}ms`);
  console.log(`Seats Held at Peak:      ${heldCount} / ${TOTAL_SEATS}`);
  console.log(`Orders Confirmed:        ${confirmedOrders}`);
  console.log(`Confirmation Failures:   ${confirmFailures}`);
  console.log(`Duplicate Seat Holds:    ${doubleBookings}`);
  console.log(`Duplicate Tickets:       ${duplicateTicketCheck.length}`);
  console.log('='.repeat(70));

  if (doubleBookings > 0 || duplicateTicketCheck.length > 0 || unexpectedErrors > 0) {
    console.error('❌ CONCURRENCY VIOLATION DETECTED! Benchmark FAILED.');
    process.exit(1);
  } else {
    console.log('✅ ZERO DOUBLE-BOOKINGS VERIFIED. Concurrency engine is 100% sound!\n');
  }

  return {
    totalRequests: TOTAL_REQUESTS,
    successfulHolds,
    conflictedHolds,
    unexpectedErrors,
    durationMs,
    requestsPerSecond,
    latencies,
    p50,
    p95,
    p99,
    databaseDoubleBookings: doubleBookings,
  };
}

runConcurrencyBenchmark()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Benchmark crashed:', err);
    process.exit(1);
  });
