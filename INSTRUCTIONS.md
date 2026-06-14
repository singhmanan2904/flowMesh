# flowMesh — Setup & Run Instructions

This guide covers everything required to run flowMesh in **local development** and **production**.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Local Development Setup](#local-development-setup)
4. [Verifying the Full Order Flow](#verifying-the-full-order-flow)
5. [Production Setup](#production-setup)
6. [Troubleshooting](#troubleshooting)
7. [Process Checklist](#process-checklist)

---

## Prerequisites

Install these before starting:

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20+ recommended | Runtime |
| Yarn or npm | latest | Package manager |
| PostgreSQL | 14+ | Primary database |
| Redis | 6+ | BullMQ job queue |
| Stripe CLI | latest | Local webhook forwarding |
| Stripe account | test mode | Payments |

Optional:

| Tool | Purpose |
|------|---------|
| Grafana Loki | Centralized logs (see `loki-config.yaml`) |
| Frontend app | Checkout UI at `FRONTEND_URL` (default `http://localhost:3000`) |

---

## Environment Variables

Create a `.env` file in the project root. Use this template (replace placeholder values):

```env
# Server
PORT=5555
NODE_ENV=development
IS_PRODUCTION=false

# Database
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5434/flowMesh_database?schema=public"

# Redis (BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379

# Auth
SECRET_JWT=your-jwt-secret-min-32-chars
COOKIE_SECRET=your-cookie-secret-min-32-chars

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Frontend (CORS + Stripe redirect URLs)
FRONTEND_URL=http://localhost:3000

# Logging (optional)
LOG_LEVEL=info
ENABLE_LOKI=false
LOKI_HOST=http://localhost:3100
```

### Variable reference

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | API port (default `5555`) |
| `NODE_ENV` | No | `development` or `production` |
| `IS_PRODUCTION` | Yes | Controls secure cookie flag (`true` in prod) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_HOST` | Yes | Redis hostname |
| `REDIS_PORT` | Yes | Redis port |
| `SECRET_JWT` | Yes | JWT signing secret |
| `COOKIE_SECRET` | Yes | Fastify cookie plugin secret |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key (`sk_test_` or `sk_live_`) |
| `STRIPE_WEBHOOK_SECRET` | Yes | Webhook signing secret (`whsec_...`) |
| `FRONTEND_URL` | Yes | Frontend origin for CORS and Stripe redirects |
| `LOG_LEVEL` | No | Pino log level (default `info`) |
| `ENABLE_LOKI` | No | Set to `false` to disable Loki transport |
| `LOKI_HOST` | No | Loki push URL (default `http://localhost:3100`) |

### Stripe webhook secret — dev vs prod

- **Development:** Use the secret printed by `stripe listen` (changes each session unless you use `--print-secret`)
- **Production:** Use the signing secret from the Stripe Dashboard webhook endpoint you create for your deployed API URL

Never commit real secrets to git.

---

## Local Development Setup

You need **six services/processes** for the full order flow to work end-to-end.

### Step 1 — Clone and install dependencies

```bash
git clone <repo-url>
cd flowMesh-backend
yarn install
```

### Step 2 — Start PostgreSQL

Run PostgreSQL locally (port in your `DATABASE_URL`, e.g. `5434`):

```bash
# Example with Docker
docker run --name flowmesh-postgres \
  -e POSTGRES_PASSWORD=mypassword \
  -e POSTGRES_DB=flowMesh_database \
  -p 5434:5432 \
  -d postgres:16
```

### Step 3 — Start Redis

```bash
# Example with Docker
docker run --name flowmesh-redis \
  -p 6379:6379 \
  -d redis:7
```

Verify Redis is reachable:

```bash
redis-cli ping
# PONG
```

### Step 4 — Configure `.env`

Copy the template above into `.env` and fill in your values.

### Step 5 — Run database migrations

```bash
npx prisma migrate dev
npx prisma generate
```

This applies all migrations in `prisma/migrations/` and generates the Prisma client to `src/generated/prisma/`.

### Step 6 — Seed the product catalog

```bash
yarn db:seed
```

Seeds 6 sample products (`prod-001` … `prod-006`). Orders reference these IDs.

### Step 7 — Start the API server

**Terminal 1:**

```bash
yarn dev
```

Expected output:

```
Server listening at http://127.0.0.1:5555
Server started
```

The API loads env vars via `dotenv` in `lib/prismaClient.ts` and worker entry points.

### Step 8 — Start background workers

Workers must be running for order/payment/shipment status updates after the Stripe webhook fires.

**Terminal 2 — Payment worker:**

```bash
yarn worker:payment
```

**Terminal 3 — Shipment worker:**

```bash
yarn worker:shipment
```

Both use `tsx watch` and auto-reload on file changes.

> Jobs are stored in Redis. If workers were offline when a webhook fired, they will process waiting jobs once they start. Jobs that already **failed** (after 3 retries) stay in the failed state and must be retried manually.

### Step 9 — Forward Stripe webhooks (required)

Stripe cannot reach `localhost` directly. Use the Stripe CLI:

**Terminal 4:**

```bash
stripe login
stripe listen --forward-to localhost:5555/payments/webhook
```

Copy the webhook signing secret from the CLI output:

```
> Ready! Your webhook signing secret is whsec_xxxxx
```

Set it in `.env`:

```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

Restart `yarn dev` after updating the secret.

### Step 10 — Start the frontend (optional)

Point your frontend at:

- API: `http://localhost:5555`
- Stripe success redirect: `http://localhost:3000/success` (configured via `FRONTEND_URL`)

The frontend must send the `flowmesh_token` cookie on protected API requests (register/login set this cookie).

### Step 11 — Optional: Grafana Loki

To ship logs to Loki locally:

1. Start Loki with the provided config:

```bash
# Requires Loki binary or Docker image
loki -config.file=loki-config.yaml
```

2. In `.env`:

```env
ENABLE_LOKI=true
LOKI_HOST=http://localhost:3100
```

Set `ENABLE_LOKI=false` to disable Loki and log to console only.

---

## Verifying the Full Order Flow

### 1. Register and login

```bash
curl -c cookies.txt -X POST http://localhost:5555/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123","email":"test@example.com"}'
```

### 2. List products

```bash
curl -b cookies.txt http://localhost:5555/products
```

### 3. Create an order

```bash
curl -b cookies.txt -X POST http://localhost:5555/orders \
  -H "Content-Type: application/json" \
  -d '{"products":["prod-001","prod-002"]}'
```

Response includes `paymentUrl`. Open it in a browser and complete checkout with a [Stripe test card](https://docs.stripe.com/testing#cards) (e.g. `4242 4242 4242 4242`).

### 4. Confirm webhook delivery

**API logs** should show:

```
Stripe webhook received
Checkout session completed
Payment success job enqueued
```

**Stripe CLI** should show:

```
checkout.session.completed [evt_...]
```

**Payment worker** should show:

```
Payment marked completed
Start shipment job enqueued
```

**Shipment worker** should show:

```
Shipment created
Shipment started, order_shipped job scheduled
```

### 5. Watch status progression

| Time | Order status | Trigger |
|------|--------------|---------|
| Order created | `PAYMENT_PENDING` | API |
| Payment webhook + worker | `PAYMENT_COMPLETED` | Payment worker |
| Shipment started | `SHIPPING_PENDING` | Shipment worker |
| ~60s later | `SHIPPING_COMPLETED` | `order_shipped` job |
| ~120s later | `COMPLETED` | `order_delivered` job |

```bash
curl -b cookies.txt http://localhost:5555/orders
curl -b cookies.txt http://localhost:5555/shipments/<orderId>
```

### Common mistake: success page without webhook

Being redirected to `http://localhost:3000/success?session_id=...` only means Stripe finished checkout in the browser. If `handlePaymentSuccess` never runs, check:

- Is `stripe listen` running?
- Is `STRIPE_WEBHOOK_SECRET` the CLI secret (not a Dashboard secret for a different URL)?
- Did you restart the API after changing the secret?

---

## Production Setup

### 1. Infrastructure

Provision managed or self-hosted:

| Service | Notes |
|---------|-------|
| PostgreSQL | Persistent, backed up; set `DATABASE_URL` |
| Redis | Persistent recommended for job durability; set `REDIS_HOST` / `REDIS_PORT` |
| API host | Public HTTPS URL (e.g. `https://api.yourdomain.com`) |
| Frontend | `FRONTEND_URL` must match deployed frontend origin |

### 2. Environment variables (production)

```env
NODE_ENV=production
IS_PRODUCTION=true
PORT=5555

DATABASE_URL=postgresql://...
REDIS_HOST=your-redis-host
REDIS_PORT=6379

SECRET_JWT=<strong-random-secret>
COOKIE_SECRET=<strong-random-secret>

STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...   # from Dashboard webhook endpoint

FRONTEND_URL=https://your-frontend.com

ENABLE_LOKI=true
LOKI_HOST=https://your-loki-instance
LOG_LEVEL=info
```

Use your platform's secret manager (AWS Secrets Manager, Vault, etc.) — do not bake secrets into images.

### 3. Database migrations

Run once per deploy (or as a release step):

```bash
npx prisma migrate deploy
npx prisma generate
yarn db:seed   # first deploy only, or when refreshing catalog
```

### 4. Stripe webhook (production)

1. Open [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://api.yourdomain.com/payments/webhook`
3. Enable events:
   - `checkout.session.completed`
   - `payment_intent.payment_failed`
   - `checkout.session.expired`
4. Copy the endpoint **signing secret** → `STRIPE_WEBHOOK_SECRET`

Do **not** use `stripe listen` in production.

### 5. Run processes

The app currently has no `build` script — processes run via `tsx`. For production you can:

**Option A — Run with tsx (simple):**

```bash
# API
NODE_ENV=production tsx src/server.ts

# Workers (separate processes)
NODE_ENV=production tsx src/workers/paymentWorker.ts
NODE_ENV=production tsx src/workers/shipmentWorker.ts
```

**Option B — Process manager (recommended):**

Use PM2, systemd, Kubernetes, or your platform's worker model. Example PM2 `ecosystem.config.cjs`:

```javascript
module.exports = {
  apps: [
    { name: "flowmesh-api", script: "tsx", args: "src/server.ts", instances: 1 },
    { name: "flowmesh-payment-worker", script: "tsx", args: "src/workers/paymentWorker.ts", instances: 1 },
    { name: "flowmesh-shipment-worker", script: "tsx", args: "src/workers/shipmentWorker.ts", instances: 1 },
  ],
};
```

Run all three processes in production. A single API instance without workers will accept orders but **will not** advance payment/shipment status after webhooks.

### 6. CORS and cookies

- `FRONTEND_URL` must exactly match the frontend origin registered in CORS
- Frontend must be served over HTTPS in production
- Frontend must use `credentials: "include"` on fetch/axios calls so cookies are sent

### 7. Health and monitoring

The API does not expose a health endpoint yet. Monitor:

- API process (port `5555`)
- Payment and shipment worker logs
- Redis connectivity
- PostgreSQL connectivity
- Stripe webhook delivery in Dashboard → Webhooks → event log
- Failed BullMQ jobs (consider adding Bull Board or Redis inspection)

### 8. Graceful shutdown

Workers do not yet handle `SIGTERM` for in-flight jobs. On deploy, allow a short drain period or use BullMQ stalled-job recovery.

### 9. Production deploy checklist

- [ ] PostgreSQL running, `DATABASE_URL` set
- [ ] Redis running, `REDIS_HOST` / `REDIS_PORT` set
- [ ] `npx prisma migrate deploy` completed
- [ ] Products seeded (`yarn db:seed`) if needed
- [ ] API process running (`tsx src/server.ts`)
- [ ] Payment worker running
- [ ] Shipment worker running
- [ ] Stripe live keys configured
- [ ] Stripe Dashboard webhook pointing to `/payments/webhook`
- [ ] `STRIPE_WEBHOOK_SECRET` matches Dashboard endpoint
- [ ] `FRONTEND_URL` set to production frontend
- [ ] `IS_PRODUCTION=true`, strong JWT/cookie secrets
- [ ] HTTPS enabled on API and frontend

---

## Troubleshooting

### Order stuck at `PAYMENT_PENDING`

| Cause | Fix |
|-------|-----|
| Stripe webhook not reaching API | Run `stripe listen` in dev; configure Dashboard webhook in prod |
| Wrong `STRIPE_WEBHOOK_SECRET` | Use CLI secret in dev; Dashboard secret in prod; restart API |
| Payment worker not running | Start `yarn worker:payment` |
| Checkout never completed | Finish payment in Stripe Checkout UI |

### Order stuck at `PAYMENT_COMPLETED`

| Cause | Fix |
|-------|-----|
| Shipment worker not running | Start `yarn worker:shipment` |
| Shipment job failed | Check worker logs; retry failed job in Redis |
| Redis down when job was enqueued | Ensure Redis is up; re-trigger webhook or re-enqueue job |

### `stripe listen` shows events but API does not log them

- Confirm forward URL: `localhost:5555/payments/webhook`
- Restart API after changing `STRIPE_WEBHOOK_SECRET`
- Check for `Failed to verify Stripe webhook signature` in logs

### Auth returns 401 on protected routes

- Register/login first to get `flowmesh_token` cookie
- Send cookie on requests (`credentials: "include"` in browser fetch)
- Token expires after 24 hours — log in again

### `Products not found` on order creation

```bash
yarn db:seed
```

### Prisma client errors after schema change

```bash
npx prisma generate
```

---

## Process Checklist

### Development — all terminals

| # | Terminal | Command | Required for |
|---|----------|---------|--------------|
| 1 | API | `yarn dev` | HTTP API |
| 2 | Payment worker | `yarn worker:payment` | Payment status updates |
| 3 | Shipment worker | `yarn worker:shipment` | Shipment status updates |
| 4 | Stripe CLI | `stripe listen --forward-to localhost:5555/payments/webhook` | Payment webhooks |
| — | PostgreSQL | running | Database |
| — | Redis | running | Job queue |
| — | Frontend | `localhost:3000` (or your `FRONTEND_URL`) | Checkout UI |

### Production — all processes

| Process | Command | Notes |
|---------|---------|-------|
| API | `NODE_ENV=production tsx src/server.ts` | Behind HTTPS reverse proxy |
| Payment worker | `NODE_ENV=production tsx src/workers/paymentWorker.ts` | Always on |
| Shipment worker | `NODE_ENV=production tsx src/workers/shipmentWorker.ts` | Always on |
| Stripe | Dashboard webhook | No CLI in prod |
| PostgreSQL | managed instance | `migrate deploy` on release |
| Redis | managed instance | Required for BullMQ |

---

For architecture details and API reference, see [README.md](./README.md).
