import Fastify from "fastify";
import orderRoute from "./api/routes/ordersRouter.js"
import authRouter from "./api/routes/authRouter.js";
import shipmentRouter from "./api/routes/shipmentRouter.js";
import paymentRouter from "./api/routes/paymentRouter.js";

const isDev = process.env.NODE_ENV !== "production";

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
    ...(isDev && {
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
        },
      },
    }),
  },
});

fastify.register(orderRoute, {prefix: "/orders"});
fastify.register(authRouter, {prefix: "/auth"});
fastify.register(shipmentRouter, {prefix: "/shipments"});
fastify.register(paymentRouter, {prefix: "/payments"});

async function main() {
    const port = Number(process.env.PORT) || 5555;
    await fastify.listen({ port });
    fastify.log.info(`Server started on port ${port}`);
}

["SIGINT", "SIGTERM"].forEach((signal) => {
    process.on(signal, async() => {
        await fastify.close();
        process.exit(0);
    })
})

main();
