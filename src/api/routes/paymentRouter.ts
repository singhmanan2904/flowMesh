import type { FastifyInstance } from "fastify";
import { getPaymentController, stripeWebhookController } from "../controllers/payment.controller.js";

function paymentRouter(fastify: FastifyInstance) {
    fastify.addContentTypeParser(
        "application/json",
        { parseAs: "buffer" },
        (request, body, done) => {
            try {
                request.rawBody = body;
                done(null, JSON.parse(body.toString()));
            } catch (err) {
                done(err as Error, undefined);
            }
        }
    );

    fastify.get("/:orderId", {
        handler: getPaymentController,
    });

    fastify.post("/webhook", {
        handler: stripeWebhookController,
    });
}

export default paymentRouter;
