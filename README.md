# flowMesh Backend

**flowMesh** is a TypeScript backend that models an **order → payment → shipment** workflow. It uses a Fastify API, PostgreSQL (Prisma), Stripe Checkout, and BullMQ + Redis for async background processing.

This repo is structured as a learning/demo project for event-driven order fulfillment.

---

## Features

### Authentication (`/auth`)

- **Register** — creates a user with bcrypt-hashed password and email; returns an HTTP-only JWT cookie (`flowmesh_token`, 24h expiry)
- **Login** — validates credentials and sets the same JWT cookie
- Protected routes read the token from cookies (not `Authorization: Bearer`)

### Products (`/products`) — protected

- **GET /** — list all products
- **POST /** — create a product (`id`, `price`, `imageUrl`)

### Orders (`/orders`) — protected

- **GET /** — list orders for the authenticated user
- **POST /** — create an order with `products[]` (product IDs)
  - Validates products exist and calculates `totalAmount` from the product catalog
  - Uses a Prisma transaction to create `Orders` + `Payment` records
  - Creates a Stripe Checkout Session and returns `paymentUrl`, `orderId`, `paymentId`, `sessionId`

### Payments (`/payments`)

- **POST /webhook** — Stripe webhook endpoint (no JWT; verified via Stripe signing secret)
  - Handles `checkout.session.completed`, `payment_intent.payment_failed`, `checkout.session.expired`
  - Enqueues payment jobs to BullMQ on success/failure
- **GET /:orderId** — fetch payment records for given order IDs (query: `orderId`)

### Shipments (`/shipments`) — protected

- **GET /:orderId** — fetch shipment(s) for a given order

### Background Workers (BullMQ + Redis)

| Worker | Queue | Jobs |
|--------|-------|------|
| Payment worker | `paymentQueue` | `payment_completed`, `payment_failed` |
| Shipment worker | `shipmentQueue` | `start_shipment`, `order_shipped`, `order_delivered` |

**Payment worker** — on `payment_completed`:
- Updates `Payment` → `COMPLETED` and `Orders` → `PAYMENT_COMPLETED`
- Enqueues `start_shipment` on the shipment queue

**Shipment worker** — simulates fulfillment with delayed jobs:
- `start_shipment` → creates shipment (`PENDING`), order → `SHIPPING_PENDING`; schedules `order_shipped` after **60s**
- `order_shipped` → shipment → `SHIPPED`, order → `SHIPPING_COMPLETED`; schedules `order_delivered` after **120s**
- `order_delivered` → shipment → `DELIVERED`, order → `COMPLETED`

Jobs are persisted in Redis. Workers do not need to be running when a job is enqueued — they pick up waiting jobs when they start.

### Observability

- Structured logging via **Pino**
- Pretty console output in development
- Optional **Grafana Loki** shipping (`pino-loki`, configurable via env)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js + TypeScript (`tsx` for dev) |
| HTTP | Fastify 5 |
| Database | PostgreSQL + Prisma 7 (driver adapter) |
| Queue | BullMQ + Redis |
| Payments | Stripe Checkout |
| Auth | bcryptjs + jsonwebtoken + HTTP-only cookies |
| Logging | Pino, pino-pretty, pino-loki |

---

## Order Lifecycle

```mermaid
stateDiagram-v2
    [*] --> PAYMENT_PENDING: POST /orders
    PAYMENT_PENDING --> PAYMENT_COMPLETED: Stripe webhook → payment worker
    PAYMENT_PENDING --> PAYMENT_FAILED: Stripe webhook → payment worker
    PAYMENT_COMPLETED --> SHIPPING_PENDING: shipment worker (start_shipment)
    SHIPPING_PENDING --> SHIPPING_COMPLETED: shipment worker (order_shipped)
    SHIPPING_COMPLETED --> COMPLETED: shipment worker (order_delivered)
```

### Important: redirect ≠ webhook

Completing Stripe Checkout redirects the browser to your frontend `success` page. That redirect alone does **not** update order status. Status changes happen when:

1. Stripe sends `checkout.session.completed` to `POST /payments/webhook`
2. The payment worker processes the queued job
3. The shipment worker processes the chained jobs

In local development you must forward Stripe webhooks with the Stripe CLI (see [INSTRUCTIONS.md](./INSTRUCTIONS.md)).

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | No | Register user |
| POST | `/auth/login` | No | Login |
| GET | `/products` | Cookie | List products |
| POST | `/products` | Cookie | Create product |
| GET | `/orders` | Cookie | List user's orders |
| POST | `/orders` | Cookie | Create order + Stripe session |
| GET | `/payments/:orderId` | No* | Get payments by order ID |
| POST | `/payments/webhook` | Stripe signature | Stripe webhook |
| GET | `/shipments/:orderId` | Cookie | Get shipment for order |

\* Payment GET route is currently unauthenticated.

Default API port: **5555**

---

## Project Structure

```
flowMesh-backend/
├── lib/
│   ├── prismaClient.ts       # Prisma + pg adapter singleton
│   └── stripe.ts             # Stripe client
├── logger/
│   └── logger.ts             # Pino logger (pretty + Loki)
├── prisma/
│   ├── schema.prisma         # DB models & enums
│   ├── migrations/           # Prisma migrations
│   └── seed.ts               # Product catalog seed
├── src/
│   ├── server.ts             # Fastify entry point
│   ├── api/
│   │   ├── routes/           # auth, orders, payments, shipments, products
│   │   ├── controllers/
│   │   ├── middlewares/      # JWT cookie auth
│   │   └── services/         # order, payment, Stripe helpers
│   ├── queue/                # paymentQueue, shipmentQueue
│   ├── workers/              # paymentWorker, shipmentWorker
│   ├── schema/               # Fastify JSON Schema validation
│   └── generated/prisma/     # Prisma client output
├── loki-config.yaml          # Local Loki config (optional)
├── INSTRUCTIONS.md           # Detailed dev & prod setup guide
└── package.json
```

---

## NPM Scripts

| Script | Purpose |
|--------|---------|
| `yarn dev` | Start API server (watch mode) |
| `yarn worker:payment` | Start payment worker (watch mode) |
| `yarn worker:shipment` | Start shipment worker (watch mode) |
| `yarn db:seed` | Seed product catalog |

Database migrations:

```bash
npx prisma migrate dev    # development
npx prisma migrate deploy # production
npx prisma generate       # regenerate client after schema changes
```

---

## Environment Variables

See [INSTRUCTIONS.md](./INSTRUCTIONS.md) for the full list and setup. Required variables include:

- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_HOST`, `REDIS_PORT` — Redis for BullMQ
- `SECRET_JWT`, `COOKIE_SECRET` — auth
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — Stripe
- `FRONTEND_URL` — CORS + Stripe redirect URLs
- `PORT` — API port (default `5555`)

---

## Getting Started

Full step-by-step setup (PostgreSQL, Redis, Stripe CLI, workers, production deployment) is in **[INSTRUCTIONS.md](./INSTRUCTIONS.md)**.

Quick local start (after dependencies are running):

```bash
yarn install
npx prisma migrate dev
yarn db:seed

# Terminal 1
yarn dev

# Terminal 2
yarn worker:payment

# Terminal 3
yarn worker:shipment

# Terminal 4 — Stripe webhook forwarding (required for payment status updates)
stripe listen --forward-to localhost:5555/payments/webhook
```

---

## Data Model

| Model | Purpose |
|-------|---------|
| `Users` | Auth (username, email, password) |
| `Product` | Catalog (`id`, `price`, `imageUrl`) |
| `Orders` | Product list, total, status, linked to user |
| `Payment` | One-to-one with order, status enum |
| `Shipment` | One-to-one with order, products, status enum |

---

## License

ISC
