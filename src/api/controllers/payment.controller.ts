import type { FastifyReply, FastifyRequest } from "fastify";
import { handlePaymentSuccess } from "../services/handlePaymentSuccess.js";
import { stripe } from "../../../lib/stripe.js";
import type Stripe from "stripe";
import { handlePaymentFailure } from "../services/handlePaymentFailure.js";
import { prisma } from "../../../lib/prismaClient.js";

/**
 * Stripe webhook endpoint — no JWT auth; verify via Stripe signing secret instead.
 */
export const stripeWebhookController = async function (
    request: FastifyRequest<{
        Body: {
            "stripe-signature": string;
        };
    }>,
    reply: FastifyReply
) {
    try {
        // TODO: verify Stripe signature (request.rawBody + stripe-signature header)
        // TODO: parse event; on checkout.session.completed call handlePaymentSuccess(...)
        const signature = request.headers["stripe-signature"];
        if (!signature || Array.isArray(signature) || !request.rawBody) {
            return reply.code(400).send({ message: "Invalid webhook request" });
        }

        let event;
        try {
            event = stripe.webhooks.constructEvent(request.rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET!);
        } catch (err) {
            request.log.error(`Error parsing Stripe event: ${err}`);
            return reply.code(400).send({ message: "Invalid event" });
        }
        
        switch (event.type) {
            case "checkout.session.completed":
                const session = event.data.object as Stripe.Checkout.Session;
                await handlePaymentSuccess({
                    orderId: session.metadata?.orderId ?? "",
                    paymentId: session.metadata?.paymentId ?? "",
                    sessionId: session.id,
                    products: session.metadata?.products ?? "",
                });
                break;
            case "payment_intent.payment_failed":
                const paymentIntent = event.data.object as Stripe.PaymentIntent;
                await handlePaymentFailure({
                    orderId: paymentIntent.metadata?.orderId ?? "",
                    paymentId: paymentIntent.id,
                    sessionId: paymentIntent.id,
                    products: paymentIntent.metadata?.products ?? "",
                });
                break;
            case "checkout.session.expired":
                const expiredSession = event.data.object as Stripe.Checkout.Session;
                await handlePaymentFailure({
                    orderId: expiredSession.metadata?.orderId ?? "",
                    paymentId: expiredSession.metadata?.paymentId ?? "",
                    sessionId: expiredSession.id,
                    products: expiredSession.metadata?.products ?? "",
                });
                break;
        }

        return reply.code(200).send({ received: true });
    } catch (err) {
        request.log.error(`Stripe webhook error: ${err}`);
        return reply.code(400).send({ message: "Webhook handler failed" });
    }
};

export const getPaymentController = async function (
    request: FastifyRequest<{
        Querystring: {
            orderId: string[];
        };
    }>,
    reply: FastifyReply
) {
    try {
        const payments = await prisma.payment.findMany({
            where: {
                orderId: {
                    in: request.query.orderId,
                },
            },
        });
        return reply.code(200).send({ payments });
    } catch (err) {
        request.log.error(`Error getting payments: ${err}`);
        return reply.code(500).send({ message: "Error getting payments" });
    }
};