# Event Booking Concurrency & Load Testing

This directory contains load tests designed to verify concurrency safety, deadlock prevention, and the **zero double-booking guarantee** under flash-sale spikes.

---

## 1. Running the Native Concurrency Benchmark (No Docker / k6 required)

Runs a high-stress simulation of **1,000 rapid concurrent hold requests** across 200 virtual users competing for 50 seats, followed by real-time database integrity audit (checking for duplicate holds and tickets):

```bash
# From repository root or apps/api:
pnpm --filter api test:load
```

---

## 2. Running k6 with Docker

If you have Docker installed, you can run the official Grafana k6 container against your running API server (`http://localhost:4000`):

### Windows (PowerShell):
```powershell
# Ensure apps/api dev server is running on port 4000
docker run --rm -i --network=host -e API_URL="http://localhost:4000" grafana/k6 run - < load-tests/k6-seat-race.js
```

### Linux / macOS:
```bash
docker run --rm -i --network=host -e API_URL="http://localhost:4000" grafana/k6 run - < load-tests/k6-seat-race.js
```

---

## 3. Running with Local k6 Binary

If `k6` is installed on your machine:

```bash
k6 run load-tests/k6-seat-race.js
```

To target a remote staging/production deployment:
```bash
API_URL="https://api.yourdomain.com" k6 run load-tests/k6-seat-race.js
```

---

## Key Metrics Evaluated

| Metric | Target | Description |
|---|---|---|
| `server_errors_5xx` | **0** | Confirms no unhandled crashes, deadlocks, or 500 errors. |
| `non_5xx_rate` | **> 99%** | All requests gracefully receive either `200 OK` (held) or `409 Conflict`. |
| `double_bookings` | **0** | Confirms strict atomic database exclusivity under high parallelism. |
| `p(95) latency` | **< 400ms** | Response latency during high-load contention. |
