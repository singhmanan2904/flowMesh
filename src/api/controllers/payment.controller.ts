import type { FastifyReply, FastifyRequest } from "fastify";
import { handlePaymentSuccess } from "../services/handlePaymentSuccess.js";

/**
 * Stripe webhook endpoint — no JWT auth; verify via Stripe signing secret instead.
 */
export const stripeWebhookController = async function (
    request: FastifyRequest,
    reply: FastifyReply
) {
    try {
        // TODO: verify Stripe signature (request.rawBody + stripe-signature header)
        // TODO: parse event; on checkout.session.completed call handlePaymentSuccess(...)
        await handlePaymentSuccess({
            orderId: "",
            paymentId: "",
            sessionId: "",
        });

        return reply.code(200).send({ received: true });
    } catch (err) {
        request.log.error(`Stripe webhook error: ${err}`);
        return reply.code(400).send({ message: "Webhook handler failed" });
    }
};
