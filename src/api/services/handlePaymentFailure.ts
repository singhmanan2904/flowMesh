import { PaymentStatus } from "../../generated/prisma/client.js";
import { paymentQueue } from "../../queue/payment.queue.js";
import { createLogger } from "../../../logger/logger.js";

const log = createLogger("handlePaymentFailure");

export type HandlePaymentFailureInput = {
    orderId: string;
    paymentId: string;
    sessionId: string;
    products: string;
};

export const handlePaymentFailure = async ({ orderId, paymentId, sessionId, products }: HandlePaymentFailureInput) => {
    try {
        if (!orderId || !paymentId) {
            log.error({ orderId, paymentId, sessionId }, "Invalid payment failure input");
            throw new Error("Invalid input");
        }

        const parsedProducts = products ? JSON.parse(products) : [];
        await paymentQueue.add(
            "payment_failed",
            { id: paymentId, status: PaymentStatus.FAILED, orderId, products: parsedProducts },
            {
                attempts: 3,
                backoff: {
                    type: "exponential",
                    delay: 1000,
                },
            }
        );
        log.info({ orderId, paymentId, sessionId }, "Payment failure job enqueued");
    } catch (err) {
        log.error({ err, orderId, paymentId, sessionId }, "Failed to handle payment failure");
        throw new Error(`Failed to handle payment failure: ${err}`);
    }
};
