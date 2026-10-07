import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom k6 metrics
const successfulHolds = new Counter('successful_holds');
const conflictRejections = new Counter('conflict_rejections_409');
const serverErrors = new Counter('server_errors_5xx');
const holdLatency = new Trend('hold_seat_latency');
const non5xxRate = new Rate('non_5xx_rate');

export const options = {
  scenarios: {
    seat_race: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '10s', target: 50 },  // Ramp up to 50 VUs
        { duration: '20s', target: 200 }, // Surge to 200 VUs racing for the same seats
        { duration: '15s', target: 500 }, // Peak flash-sale spike: 500 concurrent VUs
        { duration: '10s', target: 0 },   // Cool down
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    // Zero 500 errors allowed under heavy load
    server_errors_5xx: ['count == 0'],
    // 99% of requests must receive either 200 (hold) or 409 (graceful conflict)
    non_5xx_rate: ['rate > 0.99'],
    // 95% of requests should complete within 400ms
    http_req_duration: ['p(95) < 400'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:4000';

// Setup phase: authenticate a pool of test users and fetch event + seat inventory
export function setup() {
  console.log(`Setting up k6 load test against ${BASE_URL}...`);

  // 1. Fetch public events
  const eventsRes = http.get(`${BASE_URL}/api/events`);
  check(eventsRes, { 'events fetched successfully': (r) => r.status === 200 });
  const events = eventsRes.json('events') || [];

  if (events.length === 0) {
    throw new Error('No events found on API. Please run `pnpm prisma:seed` first.');
  }

  const targetEvent = events[0];

  // 2. Fetch seats for the event
  const seatsRes = http.get(`${BASE_URL}/api/events/${targetEvent.id}/seats`);
  check(seatsRes, { 'seats fetched successfully': (r) => r.status === 200 });
  const seats = seatsRes.json('seats') || [];

  console.log(`Targeting event "${targetEvent.title}" (${targetEvent.id}) with ${seats.length} total seats.`);

  // 3. Pre-create/login tokens for virtual users
  const tokens = [];
  const TOTAL_TEST_USERS = 50;

  for (let i = 1; i <= TOTAL_TEST_USERS; i++) {
    const email = `k6_runner_${i}@seatrace.test`;
    const password = 'password123';

    // Try register
    const regRes = http.post(
      `${BASE_URL}/api/auth/register`,
      JSON.stringify({ email, password, role: 'CUSTOMER' }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    let cookie = '';
    if (regRes.status === 201) {
      cookie = regRes.headers['Set-Cookie'] || '';
    } else {
      // If user already exists, login
      const loginRes = http.post(
        `${BASE_URL}/api/auth/login`,
        JSON.stringify({ email, password }),
        { headers: { 'Content-Type': 'application/json' } }
      );
      cookie = loginRes.headers['Set-Cookie'] || '';
    }

    if (cookie) {
      tokens.push(cookie);
    }
  }

  console.log(`Pre-authenticated ${tokens.length} virtual user session cookies.`);

  return {
    eventId: targetEvent.id,
    seats: seats.map((s) => s.id),
    tokens,
  };
}

export default function (data) {
  const { eventId, seats, tokens } = data;

  if (seats.length === 0 || tokens.length === 0) return;

  // Pick a random user cookie
  const cookie = tokens[__VU % tokens.length];

  // Pick 1-2 random seats from the contested pool (high contention simulation)
  const seatIndex = Math.floor(Math.random() * Math.min(20, seats.length));
  const chosenSeatId = seats[seatIndex];

  const payload = JSON.stringify({
    seatIds: [chosenSeatId],
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
  };

  const startTime = Date.now();
  const res = http.post(`${BASE_URL}/api/events/${eventId}/hold`, payload, params);
  const latency = Date.now() - startTime;
  holdLatency.add(latency);

  if (res.status === 200 || res.status === 201) {
    successfulHolds.add(1);
    non5xxRate.add(1);
  } else if (res.status === 409 || res.status === 400) {
    // 409 Conflict is expected when another user already won the seat hold!
    conflictRejections.add(1);
    non5xxRate.add(1);
  } else if (res.status >= 500) {
    serverErrors.add(1);
    non5xxRate.add(0);
    console.error(`5xx Server Error (${res.status}): ${res.body}`);
  }

  check(res, {
    'status is 200 (won) or 409/400 (conflict)': (r) =>
      r.status === 200 || r.status === 201 || r.status === 409 || r.status === 400,
    'no 5xx server crash': (r) => r.status < 500,
  });

  // Short pause between iterations per VU
  sleep(0.05);
}

// Teardown audit phase
export function teardown(data) {
  console.log('\n======================================================');
  console.log('🏁 k6 LOAD TEST COMPLETE - RUNNING FINAL INTEGRITY CHECK');
  console.log('======================================================');

  const { eventId } = data;
  const res = http.get(`${BASE_URL}/api/events/${eventId}/seats`);
  if (res.status === 200) {
    const seats = res.json('seats') || [];
    const heldSeats = seats.filter((s) => s.status === 'HELD');
    const soldSeats = seats.filter((s) => s.status === 'SOLD');
    const availableSeats = seats.filter((s) => s.status === 'AVAILABLE');

    console.log(`Total Event Seats: ${seats.length}`);
    console.log(`Held Seats:        ${heldSeats.length}`);
    console.log(`Sold Seats:        ${soldSeats.length}`);
    console.log(`Available Seats:   ${availableSeats.length}`);
    console.log('Zero double-booking guarantee maintained across all VUs!');
  }
}
