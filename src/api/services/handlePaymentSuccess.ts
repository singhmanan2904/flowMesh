import { PaymentStatus } from "../../generated/prisma/enums.js";
import { paymentQueue } from "../../queue/payment.queue.js";
import { createLogger } from "../../../logger/logger.js";
import { prisma } from "../../../lib/prismaClient.js";

const log = createLogger("handlePaymentSuccess");

export type HandlePaymentSuccessInput = {
    orderId: string;
    paymentId: string;
    sessionId: string;
};

/**
 * Called from the Stripe webhook when checkout.session.completed fires.
 * Updates payment/order status and kicks off the shipment flow.
 */
export async function handlePaymentSuccess({
    orderId,
    paymentId,
    sessionId,
}: HandlePaymentSuccessInput): Promise<void> {
    try {
        if (!orderId || !paymentId || !sessionId) {
            log.error({ orderId, paymentId, sessionId }, "Invalid payment success input");
            throw new Error("Invalid input");
        }

        const [order, payment] = await Promise.all([
            prisma.orders.findUnique({ where: { id: orderId } }),
            prisma.payment.findUnique({ where: { id: paymentId } }),
        ]);
        if (!order) {
            throw new Error(`Order not found: ${orderId}`);
        }
        if (!payment) {
            throw new Error(`Payment not found: ${paymentId}`);
        }
        if (payment.status === PaymentStatus.COMPLETED) {
            log.info({ orderId, paymentId, sessionId }, "Payment already completed, skipping enqueue");
            return;
        }

        log.info({ orderId, paymentId, sessionId, products: order.products }, "Payment success input");
        await paymentQueue.add(
            "payment_completed",
            { id: paymentId, status: PaymentStatus.COMPLETED, orderId, products: order.products },
            {
                jobId: `payment_completed:${paymentId}`,
                attempts: 3,
                backoff: {
                    type: "exponential",
                    delay: 1000,
                },
            }
        );
        log.info({ orderId, paymentId, sessionId, productCount: order.products.length }, "Payment success job enqueued");
    } catch (err) {
        log.error({ err, orderId, paymentId, sessionId }, "Failed to handle payment success");
        throw new Error(`Failed to handle payment success: ${err}`);
    }
}
