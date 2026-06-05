import type { FastifyInstance } from "fastify";
import { stripeWebhookController } from "../controllers/payment.controller.js";

function paymentRouter(fastify: FastifyInstance) {
    // No auth middleware — Stripe calls this directly
    fastify.post("/webhook", {
        handler: stripeWebhookController,
    });
}

export default paymentRouter;
