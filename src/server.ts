import "dotenv/config";
import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import orderRoute from "./api/routes/ordersRouter.js";
import authRouter from "./api/routes/authRouter.js";
import shipmentRouter from "./api/routes/shipmentRouter.js";
import paymentRouter from "./api/routes/paymentRouter.js";
import logger from "../logger/logger.js";
import cors from "@fastify/cors";
import fastifyCookie from "@fastify/cookie";
import { productsRouter } from "./api/routes/productsRouter.js";
import { redisClient } from "../lib/redisClient.js";

const fastify = Fastify({ loggerInstance: logger });

await fastify.register(rateLimit, {
    global: true,
    max: Number(process.env.RATE_LIMIT_MAX ?? 100),
    timeWindow: process.env.RATE_LIMIT_WINDOW ?? "1 minute",
    redis: redisClient,
    nameSpace: "flowmesh:ratelimit:",
});

fastify.register(orderRoute, { prefix: "/orders" });
fastify.register(authRouter, { prefix: "/auth" });
fastify.register(shipmentRouter, { prefix: "/shipments" });
fastify.register(paymentRouter, { prefix: "/payments" });
fastify.register(productsRouter, { prefix: "/products" });

await fastify.register(cors, {
    origin: process.env.FRONTEND_URL!,
    credentials: true,
});

fastify.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET!,
});

async function main() {
    const port = Number(process.env.PORT) || 5555;
    const host = process.env.HOST ?? "0.0.0.0";
    await fastify.listen({ port, host });
    fastify.log.info({ port, host }, "Server started");
}

fastify.addHook("onClose", async () => {
    await redisClient.quit();
});

["SIGINT", "SIGTERM"].forEach((signal) => {
    process.on(signal, async () => {
        fastify.log.info({ signal }, "Shutting down server");
        await fastify.close();
        process.exit(0);
    });
});

main().catch((err) => {
    logger.error({ err }, "Server failed to start");
    process.exit(1);
});
