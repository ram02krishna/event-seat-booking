# Concurrency-Safe Event Ticketing with an Interactive Seat Map

A full-stack, concurrency-safe event ticketing platform built to handle flash-sale traffic spikes, interactive SVG venue seating, and venue gate check-in with zero double bookings.

Designed and built as a college capstone project showcasing transaction isolation, raw SQL atomic locking, real-time WebSocket synchronization, delayed worker queues, and high-concurrency load testing.

---

## The Problem

High-demand ticket sales (concerts, sports, festivals) suffer from a classic distributed systems challenge: **extreme contention on shared state**. 

When thousands of users click the same front-row seat at the exact same millisecond:
1. **Double-Booking**: Naive implementations read seat state, verify availability in application memory, and then write. Under concurrent traffic, multiple users read "available" simultaneously, creating double bookings.
2. **Deadlocks**: Users selecting multiple seats in different order (e.g., User A selects `[1, 2]`, User B selects `[2, 1]`) can lock rows in opposite order, crashing the database with circular deadlocks.
3. **Cart Abandonment**: If users hold seats but never complete payment, seats stay locked forever unless released by an authoritative background scheduler.
4. **Gate Turnstile Race Conditions**: Fraudsters duplicating QR codes can try to scan through two venue turnstiles at the same instant.

This project solves all four problems with database-level atomicity, deterministic lock ordering, BullMQ delayed workers, and conditional gate check-in.

---

## Architecture

```
                       +---------------------------------------+
                       |          Next.js App Router           |
                       |  - Interactive SVG Seat Map           |
                       |  - Server-Authoritative Hold Timer    |
                       |  - Real-Time Socket.IO Client         |
                       |  - Staff Camera Turnstile Scanner     |
                       +-------------------+-------------------+
                                           |
                              HTTP / WebSocket (Port 4000)
                                           |
                                           v
                       +---------------------------------------+
                       |           Express API Server          |
                       |  - Zod Input Validation               |
                       |  - JWT HttpOnly Cookie Auth           |
                       |  - Socket.IO Per-Event Rooms          |
                       |  - Resend Email Service               |
                       +---------+-------------------+---------+
                                 |                   |
               Atomic $queryRaw  |                   | Delayed Jobs
               Row-Level Locks   |                   |
                                 v                   v
            +---------------------------+   +-------------------+
            |        PostgreSQL         |   |   Redis (BullMQ)  |
            |  - EventSeat (Unique idx) |   |  - 5-Min Expiry   |
            |  - Atomic UPDATE ...      |   |  - 60s Sweeper    |
            |  - Ticket QR Tokens       |   +-------------------+
            +---------------------------+
```

---

## Technical Deep Dive: The Concurrency Engine

### 1. Deadlock Prevention via Deterministic Sorting
When a user holds multiple seats, we deduplicate and sort seat IDs alphabetically before touching the database:
```ts
const sortedIds = [...new Set(seatIds)].sort();
```
If User A requests seats `[A2, A1]` and User B requests `[A1, A2]`, both transactions attempt to acquire row locks in the exact same alphabetical order (`A1` then `A2`). Circular lock wait conditions become mathematically impossible.

### 2. Atomic Conditional Seat Hold
Instead of reading with `findFirst()` and writing later, we run a single atomic conditional SQL `UPDATE` inside a Prisma transaction:
```sql
UPDATE "EventSeat"
SET 
  status = 'HELD',
  "heldByUserId" = $1,
  "holdExpiresAt" = $2,
  version = version + 1,
  "updatedAt" = NOW()
WHERE "eventId" = $3
  AND ("seatId" IN ($4) OR id IN ($4))
  AND (
    status = 'AVAILABLE'
    OR (status = 'HELD' AND "holdExpiresAt" < NOW())
  )
RETURNING id, "seatId", price;
```
- PostgreSQL acquires exclusive row-level write locks on the matching rows.
- The condition checks that seats are either `AVAILABLE` or have an expired hold timestamp.
- The first concurrent transaction gets the rows. All other concurrent transactions evaluate `status = 'AVAILABLE'` as false and return 0 rows.

### 3. All-or-Nothing Transaction Rollback
If a user requests 3 seats and only 2 were acquired (because a competitor claimed the 3rd seat a fraction of a millisecond earlier), the transaction throws an `HTTP 409 Conflict`:
```ts
if (updatedRows.length !== sortedIds.length) {
  throw new AppError(409, 'One or more selected seats are no longer available');
}
```
The database rolls back automatically. A user never ends up with a partial cart.

### 4. BullMQ & Redis Delayed Auto-Release
Once seats are held, a delayed job is pushed to BullMQ with a 5-minute delay:
- If the user confirms and pays, the hold converts to `SOLD` and the order is finalized.
- If the user abandons checkout, the BullMQ worker runs, releases the seats back to `AVAILABLE`, and emits a `seats:released` event via Socket.IO to notify all browsing clients instantly.
- A secondary 60-second periodic cleanup job catches any edge cases if the worker restarts.

### 5. Atomic Gate Turnstile Check-In
To prevent duplicated QR codes from scanning at two doors simultaneously:
```sql
UPDATE "Ticket"
SET "checkedInAt" = NOW()
WHERE id = $1 AND "checkedInAt" IS NULL
RETURNING id, "checkedInAt";
```
If two scanners submit the same QR token concurrently, only the first query updates a row. The second query returns 0 rows and immediately fails with `409 Conflict ("Ticket already scanned at [time]")`, triggering an audible alert on the staff device.

---

## Concurrency Stress Benchmark

We benchmarked the concurrency engine with 1,000 rapid concurrent hold requests from 200 distinct virtual users racing simultaneously for a pool of 50 seats.

Run the test directly:
```bash
pnpm test:load
```

### Benchmark Results
| Metric | Value | Meaning |
|---|---|---|
| **Total Requests** | `1,000` | Rapid concurrent hold requests |
| **Successful Holds** | `37` | Users who successfully secured seat batches |
| **Conflicts Handled** | `963` | Graceful `409 Conflict` responses |
| **5xx Server Errors** | **`0`** | Zero crashes, unhandled rejections, or deadlocks |
| **Throughput** | **`900.9 req/sec`** | Sub-second high-load capacity |
| **Latency p50** | `30ms` | Median response time |
| **Latency p95** | `66ms` | 95th percentile response time |
| **Duplicate Seat Holds** | **`0`** | Verified via direct SQL group-by audit |
| **Duplicate Tickets** | **`0`** | Verified via database ticket audit |
| **Result** | **PASSED** | 100% sound concurrency safety |

A full k6 load test script is also included in [`load-tests/k6-seat-race.js`](./load-tests/k6-seat-race.js) for execution via Docker.

---

## Tech Stack

| Category | Technology |
|---|---|
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Framer Motion, Zustand, TanStack Query, Socket.IO Client, html5-qrcode |
| **Backend** | Node.js, Express, TypeScript, Zod, JWT (httpOnly cookies), Socket.IO, BullMQ, Redis, Pino, Resend SDK, QRCode |
| **Database** | PostgreSQL 16, Prisma ORM with raw atomic `$queryRaw` transactions |
| **DevOps & CI** | Docker (multi-stage), Docker Compose, GitHub Actions (Postgres & Redis service containers) |
| **Testing** | Vitest (21 integration and concurrency tests), k6 (load & race tests) |

---

## Repository Structure

```
event-seat-booking/
├── apps/
│   ├── api/                    # Express backend
│   │   ├── prisma/             # Schema, migrations, seed script
│   │   ├── src/
│   │   │   ├── jobs/           # BullMQ expiry worker & cleanup sweeper
│   │   │   ├── middleware/     # Auth, role check, validation
│   │   │   ├── routes/         # Auth, events, hold, orders, tickets, organizer
│   │   │   ├── services/       # Atomic hold SQL, order finalization, Resend email
│   │   │   ├── socket.ts       # Socket.IO room broadcaster
│   │   │   └── app.ts          # Express application setup
│   │   ├── scripts/            # Concurrency stress benchmark
│   │   └── tests/              # 21 Vitest integration tests
│   │
│   └── web/                    # Next.js frontend
│       └── src/
│           ├── app/
│           │   ├── events/[id] # Event details & interactive SVG seat map
│           │   ├── checkout/   # Checkout with server-authoritative timer
│           │   ├── my-tickets/ # Attendee ticket wallet with QR codes
│           │   ├── organizer/  # Real-time analytics, revenue, capacity dashboard
│           │   ├── staff/      # Turnstile camera scanner UI (html5-qrcode)
│           │   └── login/      # Auth screen with 1-click demo logins
│           ├── components/     # SVG seat map, pan/zoom, cart, navbar
│           └── store/          # Zustand cart store
│
├── packages/
│   └── shared/                 # Zod validation schemas and shared TypeScript types
│
├── load-tests/                 # k6 race testing scripts and Docker instructions
└── .github/workflows/          # CI pipeline with PostgreSQL and Redis containers
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm (`npm install -g pnpm`)
- PostgreSQL 16 and Redis (or Docker)

### 1. Clone & Install
```bash
git clone https://github.com/ram02krishna/event-seat-booking.git
cd event-seat-booking
pnpm install
```

### 2. Environment Variables
Copy `.env.example` to `.env` in the root and in `apps/api`:
```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
```

Ensure your `DATABASE_URL` and `REDIS_URL` are reachable:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/event_seat_booking?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="supersecretdevkey1234567890_min32chars"
```

### 3. Database Migration & Seed
Run Prisma migrations and populate the seed data (Grand Symphony Hall, 112 seats across VIP, Premium, and Standard tiers, plus 2 sample events):
```bash
pnpm --filter api prisma:migrate
pnpm --filter api prisma:seed
```

### 4. Run Development Servers
```bash
# Starts API (port 4000) and Web (port 3000) concurrently:
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Running with Docker

To run the complete stack (Postgres, Redis, Express API, Next.js Web) in containers:
```bash
docker compose up --build
```
- Web: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:4000](http://localhost:4000)

---

## Running Tests

```bash
# Run all unit, integration, and concurrency tests:
pnpm test

# Run the 1,000-request concurrency stress benchmark:
pnpm test:load

# Run full monorepo typecheck:
pnpm typecheck
```

---

## Pre-Configured Demo Accounts

All test accounts share the password: `password123`

| Role | Email | Permissions / Features |
|---|---|---|
| **ORGANIZER** | `organizer@eventseat.com` | Access `/organizer` dashboard, view revenue & occupancy analytics, create events |
| **STAFF** | `staff@eventseat.com` | Access `/staff/scanner` live camera QR code turnstile scanner |
| **CUSTOMER** | `alice@example.com` | Browse events, pick seats on SVG map, hold for 5 mins, checkout, view tickets |
| **CUSTOMER** | `bob@example.com` | Secondary customer for simulating multi-user seat competition |

---

## Key API Endpoints

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register customer / staff / organizer | Public |
| `POST` | `/api/auth/login` | Login with email and password | Public |
| `GET` | `/api/events` | List all published events | Public |
| `GET` | `/api/events/:id/seats` | Get seat map layout and availability | Public |
| `POST` | `/api/events/:id/hold` | Atomically hold seats for 5 minutes | Customer |
| `POST` | `/api/events/:id/release` | Release held seats manually | Customer |
| `POST` | `/api/orders/confirm` | Finalize payment and generate QR tickets | Customer |
| `GET` | `/api/tickets/my` | List logged-in user tickets with QR codes | Customer |
| `POST` | `/api/tickets/checkin` | Atomic turnstile QR code scan validation | Staff / Organizer |
| `GET` | `/api/organizer/stats` | Aggregate revenue, occupancy, and event stats | Organizer |
| `GET` | `/api/organizer/events/:id/stats` | Event tier breakdown and gate telemetry | Organizer |
| `POST` | `/api/organizer/events` | Create new event with tier pricing overrides | Organizer |

---

## License

MIT License. Created by Ram Krishna as a B.Tech Computer Science capstone project.
