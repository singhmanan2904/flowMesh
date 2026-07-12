import type { FastifyInstance } from "fastify";
import { prisma } from "../../../lib/prismaClient.js";
import { redisClient } from "../../../lib/redisClient.js";

async function checkDatabase(): Promise<void> {
    await prisma.$queryRaw`SELECT 1`;
}

async function checkRedis(): Promise<void> {
    const pong = await redisClient.ping();
    if (pong !== "PONG") {
        throw new Error("Redis ping failed");
    }
}

function healthRouter(fastify: FastifyInstance) {
    fastify.get("/health", {
        config: { rateLimit: false },
        handler: async (_request, reply) => {
            return reply.code(200).send({ status: "ok" });
        },
    });

    fastify.get("/ready", {
        config: { rateLimit: false },
        handler: async (_request, reply) => {
            const checks: Record<string, "ok" | "error"> = {
                database: "ok",
                redis: "ok",
            };

            try {
                await checkDatabase();
            } catch {
                checks.database = "error";
            }

            try {
                await checkRedis();
            } catch {
                checks.redis = "error";
            }

            const ready = Object.values(checks).every((status) => status === "ok");

            return reply.code(ready ? 200 : 503).send({
                status: ready ? "ready" : "not_ready",
                checks,
            });
        },
    });
}

export default healthRouter;
