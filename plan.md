src/
│
├── api/                    # Express / Fastify routes
│   ├── routes/
│   │   ├── order.routes.ts
│   │   └── payment.routes.ts
│   ├── controllers/
│   │   ├── order.controller.ts
│   │   └── payment.controller.ts
│   └── middlewares/
│       ├── auth.middleware.ts
│       └── error.middleware.ts
│
├── modules/                # Business logic (domain-based)
│   ├── order/
│   │   ├── order.service.ts
│   │   ├── order.repository.ts
│   │   ├── order.types.ts
│   │   └── order.events.ts
│   │
│   └── payment/
│       ├── payment.service.ts
│       ├── payment.repository.ts
│       ├── payment.provider.ts   # Stripe wrapper
│       └── payment.types.ts
│
├── queue/                  # Queue setup (BullMQ)
│   ├── index.ts
│   ├── queues/
│   │   └── order.queue.ts
│   └── producers/
│       └── order.producer.ts
│
├── workers/                # Background workers
│   ├── order.worker.ts
│   └── payment.worker.ts (optional later)
│
├── db/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── prismaClient.ts
│
├── config/                 # env, constants
│   ├── env.ts
│   └── constants.ts
│
├── utils/                  # helpers
│   ├── logger.ts
│   └── idempotency.ts
│
├── app.ts                  # app setup
└── server.ts               # entry point