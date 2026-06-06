import { PaymentStatus } from "../../generated/prisma/enums.js";
import { paymentQueue } from "../../queue/payment.queue.js";
import { createLogger } from "../../../logger/logger.js";

const log = createLogger("handlePaymentSuccess");

export type HandlePaymentSuccessInput = {
    orderId: string;
    paymentId: string;
    sessionId: string;
    products: string;
};

/**
 * Called from the Stripe webhook when checkout.session.completed fires.
 * Updates payment/order status and kicks off the shipment flow.
 */
export async function handlePaymentSuccess({
    orderId,
    paymentId,
    sessionId,
    products,
}: HandlePaymentSuccessInput): Promise<void> {
    try {
        if (!orderId || !paymentId || !sessionId || !products) {
            log.error({ orderId, paymentId, sessionId, hasProducts: Boolean(products) }, "Invalid payment success input");
            throw new Error("Invalid input");
        }

        const parsedProducts = JSON.parse(products);
        await paymentQueue.add(
            "payment_completed",
            { id: paymentId, status: PaymentStatus.COMPLETED, orderId, products: parsedProducts },
            {
                attempts: 3,
                backoff: {
                    type: "exponential",
                    delay: 1000,
                },
            }
        );
        log.info({ orderId, paymentId, sessionId, productCount: parsedProducts.length }, "Payment success job enqueued");
    } catch (err) {
        log.error({ err, orderId, paymentId, sessionId }, "Failed to handle payment success");
        throw new Error(`Failed to handle payment success: ${err}`);
    }
}
