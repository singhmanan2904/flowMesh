import { PaymentStatus } from "../../generated/prisma/client.js";
import { paymentQueue } from "../../queue/payment.queue.js";
import { createLogger } from "../../../logger/logger.js";
import { prisma } from "../../../lib/prismaClient.js";

const log = createLogger("handlePaymentFailure");

export type HandlePaymentFailureInput = {
    orderId: string;
    paymentId: string;
    sessionId: string;
};

export const handlePaymentFailure = async ({ orderId, paymentId, sessionId }: HandlePaymentFailureInput) => {
    try {
        if (!orderId || !paymentId) {
            log.error({ orderId, paymentId, sessionId }, "Invalid payment failure input");
            throw new Error("Invalid input");
        }

        const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
        if (!payment) {
            throw new Error(`Payment not found: ${paymentId}`);
        }
        if (payment.status !== PaymentStatus.PENDING) {
            log.info(
                { orderId, paymentId, sessionId, status: payment.status },
                "Payment not pending, skipping failure enqueue"
            );
            return;
        }

        await paymentQueue.add(
            "payment_failed",
            { id: paymentId, status: PaymentStatus.FAILED, orderId, products: [] },
            {
                jobId: `payment_failed:${paymentId}`,
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
