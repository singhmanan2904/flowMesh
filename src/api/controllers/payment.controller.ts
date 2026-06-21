import type { FastifyReply, FastifyRequest } from "fastify";
import { handlePaymentSuccess } from "../services/handlePaymentSuccess.js";
import { stripe } from "../../../lib/stripe.js";
import type Stripe from "stripe";
import { handlePaymentFailure } from "../services/handlePaymentFailure.js";
import { prisma } from "../../../lib/prismaClient.js";
import { claimIdempotencyKey, releaseIdempotencyKey } from "../../utils/idempotency.js";

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
        const signature = request.headers["stripe-signature"];
        if (!signature || Array.isArray(signature) || !request.rawBody) {
            request.log.warn("Stripe webhook rejected: missing signature or raw body");
            return reply.code(400).send({ message: "Invalid webhook request" });
        }

        let event;
        try {
            event = stripe.webhooks.constructEvent(request.rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET!);
        } catch (err) {
            request.log.error({ err }, "Failed to verify Stripe webhook signature");
            return reply.code(400).send({ message: "Invalid event" });
        }

        request.log.info({ eventType: event.type, eventId: event.id }, "Stripe webhook received");

        const webhookIdempotencyKey = `stripe:event:${event.id}`;
        const isFirstDelivery = await claimIdempotencyKey(webhookIdempotencyKey);
        if (!isFirstDelivery) {
            request.log.info(
                { eventType: event.type, eventId: event.id },
                "Duplicate Stripe webhook, skipping"
            );
            return reply.code(200).send({ received: true, duplicate: true });
        }

        try {
            switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;
                const orderId = session.metadata?.orderId ?? "";
                const paymentId = session.metadata?.paymentId ?? "";
                request.log.info({ orderId, paymentId, sessionId: session.id }, "Checkout session completed");
                await handlePaymentSuccess({
                    orderId,
                    paymentId,
                    sessionId: session.id,
                });
                break;
            }
            case "payment_intent.payment_failed": {
                const paymentIntent = event.data.object as Stripe.PaymentIntent;
                const orderId = paymentIntent.metadata?.orderId ?? "";
                request.log.warn({ orderId, paymentIntentId: paymentIntent.id }, "Payment intent failed");
                await handlePaymentFailure({
                    orderId,
                    paymentId: paymentIntent.id,
                    sessionId: paymentIntent.id,
                });
                break;
            }
            case "checkout.session.expired": {
                const expiredSession = event.data.object as Stripe.Checkout.Session;
                const orderId = expiredSession.metadata?.orderId ?? "";
                const paymentId = expiredSession.metadata?.paymentId ?? "";
                request.log.warn({ orderId, paymentId, sessionId: expiredSession.id }, "Checkout session expired");
                await handlePaymentFailure({
                    orderId,
                    paymentId,
                    sessionId: expiredSession.id,
                });
                break;
            }
            default:
                request.log.info({ eventType: event.type, eventId: event.id }, "Unhandled Stripe webhook event");
            }

            return reply.code(200).send({ received: true });
        } catch (processingErr) {
            await releaseIdempotencyKey(webhookIdempotencyKey);
            throw processingErr;
        }
    } catch (err) {
        request.log.error({ err }, "Stripe webhook handler failed");
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
    const orderIds = request.query.orderId;
    try {
        request.log.info({ orderIds }, "Fetching payments for orders");
        const payments = await prisma.payment.findMany({
            where: {
                orderId: {
                    in: orderIds,
                },
            },
        });
        request.log.info({ orderIds, paymentCount: payments.length }, "Payments fetched");
        return reply.code(200).send({ payments });
    } catch (err) {
        request.log.error({ err, orderIds }, "Failed to fetch payments");
        return reply.code(500).send({ message: "Error getting payments" });
    }
};
