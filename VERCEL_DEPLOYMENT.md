# Vercel Deployment Guide

This monorepo is fully configured and ready to deploy on [Vercel](https://vercel.com).

---

## Architecture Overview

- **Frontend (`apps/web`)**: Next.js 15 (React 19, TailwindCSS, Socket.IO Client, TanStack Query).
  - Designed for hosting on **Vercel**.
- **Backend API (`apps/api`)**: Node.js / Express with WebSocket (`Socket.IO`), BullMQ workers, Redis, and PostgreSQL (Prisma).
  - Stateful server requiring long-running processes (WebSockets & BullMQ workers).
  - Recommended hosting on platforms like **Render**, **Railway**, **Fly.io**, or any VPS / Docker host.

---

## Step 1: Deploy Frontend (`apps/web`) to Vercel

### Method A: Via Vercel Dashboard (Recommended)

1. Push your repository to GitHub / GitLab / Bitbucket.
2. Go to [Vercel Dashboard](https://vercel.com/new) and click **"Add New Project"**.
3. Import your repository: `seat-lock`.
4. In the **Project Configuration** screen:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Click *Edit* and select `apps/web`.
   - **Build and Output Settings**:
     - *Build Command*: Leave default or set `pnpm --filter @repo/shared build && next build` (a `prebuild` hook is also built-in to `apps/web/package.json`).
     - *Output Directory*: Automatically detects `.next`.
5. Under **Environment Variables**, add:
   | Variable | Value | Description |
   | :--- | :--- | :--- |
   | `NEXT_PUBLIC_API_URL` | `https://your-api-domain.com` | Production URL of your deployed Express API |
   | `NEXT_PUBLIC_SOCKET_URL` | `https://your-api-domain.com` | WebSocket endpoint URL (same as API server) |
6. Click **Deploy**.

---

### Method B: Deploy from Repository Root (`/`)

If you prefer leaving the Vercel Root Directory set to `./` (root of the monorepo):
- The repository includes a root [vercel.json](./vercel.json) that automatically routes the build to `apps/web`:
  - `buildCommand`: `pnpm --filter @repo/shared build && pnpm --filter web build`
  - `outputDirectory`: `apps/web/.next`

---

## Step 2: Configure Backend (`apps/api`)

To connect your deployed Vercel frontend with the backend API:

1. **Set `CLIENT_URL` on the API server**:
   ```env
   CLIENT_URL=https://your-app.vercel.app
   ```
   > **Tip**: You can provide a comma-separated list to support multiple domains and preview builds, e.g.:
   > `CLIENT_URL=http://localhost:3000,https://your-app.vercel.app`
   > Add each trusted preview deployment URL explicitly. The API intentionally does not wildcard-allow all `*.vercel.app` origins because authentication uses credentialed cookies.

2. **Cross-Site Authentication Cookies**:
   - The auth routes have been updated to set `SameSite: 'None'` and `Secure: true` when `NODE_ENV=production`.
   - This ensures the browser sends the authentication cookie across domains (`your-app.vercel.app` -> `your-api.onrender.com`).

3. **Backend Environment Variables**:
   ```env
   NODE_ENV=production
   PORT=4000
   CLIENT_URL=https://your-app.vercel.app
   DATABASE_URL=postgresql://user:password@host:5432/event_db?sslmode=require
   REDIS_URL=rediss://default:password@host:6379
   JWT_SECRET=replace-with-a-random-secret-of-at-least-32-characters
   ORGANIZER_EMAIL=organizer@yourdomain.com
   ORGANIZER_PASSWORD=replace-with-a-unique-password-of-at-least-8-characters
   RESEND_API_KEY=re_your_resend_key
   RESEND_FROM_EMAIL=SeatLock <tickets@your-verified-domain.com>
   ```

---

## Step 3: Local Verification

You can verify the production build locally anytime by running:

```bash
# Build the Next.js web application
pnpm run build:web

# Or build the entire monorepo
pnpm run build
```
