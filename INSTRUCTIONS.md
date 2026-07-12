# flowMesh — Setup & Run Instructions

This guide covers everything required to run flowMesh in **local development** and **production**.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Local Development Setup](#local-development-setup)
4. [Docker Compose & deploy.sh](#docker-compose--deploysh)
5. [Verifying the Full Order Flow](#verifying-the-full-order-flow)
6. [Production Setup](#production-setup)
7. [Troubleshooting](#troubleshooting)
8. [Process Checklist](#process-checklist)

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

## Docker Compose & deploy.sh

Alternative to running Postgres, Redis, and each process manually: use **Docker Compose** with the included **`deploy.sh`** helper.

### Prerequisites

- Docker and Docker Compose
- `.env` with secrets (`SECRET_JWT`, `COOKIE_SECRET`, `STRIPE_*`, `FRONTEND_URL`, etc.)
- `.env.docker` is loaded automatically and overrides hostnames for in-network services (`postgres`, `redis`, `loki`)

### First-time setup

```bash
./deploy.sh --migrate --seed
```

This rebuilds app images, starts the full stack (Postgres, Redis, API, workers, Loki, Promtail, Grafana), runs `prisma migrate deploy`, and seeds the product catalog.

### Common deploy commands

| Command | Use when |
|---------|----------|
| `./deploy.sh` | You pushed code and want to rebuild + redeploy app containers |
| `./deploy.sh --pull --migrate` | Server release: pull git, rebuild, migrate |
| `./deploy.sh --migrate-only` | Schema changed but images are already up to date |
| `./deploy.sh --recreate` | Ports, env, or `docker-compose.yml` changed |
| `./deploy.sh --restart` | Quick restart without rebuilding images |
| `./deploy.sh --down` | Stop the stack (volumes kept) |
| `./deploy.sh --logs` | Tail API + worker logs |
| `./deploy.sh --status` | Show container status |

Run `./deploy.sh --help` for the full flag list.

### What gets built

| Service | Dockerfile |
|---------|------------|
| `flowmesh-api` | `src/api/DockerFile` |
| `flowmesh-payment-worker` | `src/workers/DockerFile` |
| `flowmesh-shipment-worker` | `src/workers/DockerFile` |

Both Dockerfiles use the same **multi-stage** layout: `deps` → `build` (`prisma generate` + `yarn build`) → `prod-deps` → `runner`. The final image includes `dist/`, production `node_modules`, and `prisma/` (for in-container migrations).

### Health checks

| Endpoint | Purpose |
|----------|---------|
| `GET http://localhost:5555/health` | Liveness — API process is up |
| `GET http://localhost:5555/ready` | Readiness — PostgreSQL and Redis are reachable |

Docker Compose configures a healthcheck on `flowmesh-api` that polls `/ready`. When using `--migrate`, `deploy.sh` waits for `/ready` before running migrations.

### Manual compose commands

If you prefer not to use `deploy.sh`:

```bash
docker compose up --build -d
docker compose exec flowmesh-api npx prisma migrate deploy
docker compose exec flowmesh-api yarn db:seed
docker compose logs -f flowmesh-api
```

### Stripe webhooks with Docker

The API runs at `http://localhost:5555`. On the **host**, still run:

```bash
stripe listen --forward-to localhost:5555/payments/webhook
```

Set `STRIPE_WEBHOOK_SECRET` in `.env` to the CLI secret, then `./deploy.sh --restart`.

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

**Docker Compose:**

```bash
./deploy.sh --migrate
# or migrations only:
./deploy.sh --migrate-only
```

**Bare metal / Render:**

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

**Option A — Docker Compose (recommended for VPS/self-hosted):**

```bash
./deploy.sh              # rebuild app images and start/update stack
./deploy.sh --pull --migrate   # release workflow on a server
```

See [Docker Compose & deploy.sh](#docker-compose--deploysh).

**Option B — Compiled Node (PM2, systemd, Render):**

```bash
yarn build
yarn start                    # API only
yarn worker:payment
yarn worker:shipment
```

**Option C — tsx (simple local prod test):**

```bash
NODE_ENV=production tsx src/server.ts
NODE_ENV=production tsx src/workers/paymentWorker.ts
NODE_ENV=production tsx src/workers/shipmentWorker.ts
```

**Option D — Process manager (PM2 example):**

Use PM2, systemd, Kubernetes, or your platform's worker model. Example PM2 `ecosystem.config.cjs`:

```javascript
module.exports = {
  apps: [
    { name: "flowmesh-api", script: "node", args: "dist/src/api.js", instances: 1 },
    { name: "flowmesh-payment-worker", script: "node", args: "dist/src/workers/paymentWorker.js", instances: 1 },
    { name: "flowmesh-shipment-worker", script: "node", args: "dist/src/workers/shipmentWorker.js", instances: 1 },
  ],
};
```

Run all three processes in production when using split workers. A single API instance without workers will accept orders but **will not** advance payment/shipment status after webhooks.

### 6. CORS and cookies

- `FRONTEND_URL` must exactly match the frontend origin registered in CORS
- Frontend must be served over HTTPS in production
- Frontend must use `credentials: "include"` on fetch/axios calls so cookies are sent

### 7. Health and monitoring

The API exposes health endpoints (not rate-limited):

| Endpoint | Purpose | Success |
|----------|---------|---------|
| `GET /health` | Liveness | `200 { "status": "ok" }` |
| `GET /ready` | Readiness (DB + Redis) | `200 { "status": "ready", "checks": { ... } }` |

Use `/health` for simple uptime probes. Use `/ready` before sending traffic or after deploys — returns `503` if Postgres or Redis is down.

Also monitor:

- Payment and shipment worker logs (`./deploy.sh --logs` or your log aggregator)
- Stripe webhook delivery in Dashboard → Webhooks → event log
- Failed BullMQ jobs (consider adding Bull Board or Redis inspection)
- Docker health status: `./deploy.sh --status` or `docker compose ps`

### 8. Graceful shutdown

Workers do not yet handle `SIGTERM` for in-flight jobs. On deploy, allow a short drain period or use BullMQ stalled-job recovery.

### 9. Production deploy checklist

- [ ] PostgreSQL running, `DATABASE_URL` set
- [ ] Redis running, `REDIS_HOST` / `REDIS_PORT` (or `REDIS_URL`) set
- [ ] `npx prisma migrate deploy` completed (or `./deploy.sh --migrate`)
- [ ] Products seeded (`yarn db:seed` or `./deploy.sh --seed`) if needed
- [ ] API process running (`yarn start`, Docker, or PM2)
- [ ] Payment worker running
- [ ] Shipment worker running
- [ ] `GET /ready` returns `200` with database and redis checks ok
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
| 2 | Payment worker | `yarn dev:worker:payment` | Payment status updates |
| 3 | Shipment worker | `yarn dev:worker:shipment` | Shipment status updates |
| 4 | Stripe CLI | `stripe listen --forward-to localhost:5555/payments/webhook` | Payment webhooks |
| — | PostgreSQL | running | Database |
| — | Redis | running | Job queue |
| — | Frontend | `localhost:3000` (or your `FRONTEND_URL`) | Checkout UI |

### Production — all processes

| Process | Command | Notes |
|---------|---------|-------|
| Full stack (Docker) | `./deploy.sh --pull --migrate` | Rebuilds API + workers; see [Docker Compose & deploy.sh](#docker-compose--deploysh) |
| API | `yarn start` or `node dist/src/api.js` | HTTP only — run workers separately |
| Payment worker | `yarn worker:payment` | Always on (separate container/process) |
| Shipment worker | `yarn worker:shipment` | Always on (separate container/process) |
| Stripe | Dashboard webhook | No CLI in prod |
| PostgreSQL | managed instance | `migrate deploy` on release |
| Redis | managed instance | Required for BullMQ |
| Health | `GET /ready` | Confirm DB + Redis before routing traffic |

---

For architecture details and API reference, see [README.md](./README.md).
