import { prisma } from "../../../lib/prismaClient.js";
import { PaymentStatus } from "../../generated/prisma/client.js";
import { paymentQueue } from "../../queue/payment.queue.js";

export type HandlePaymentFailureInput = {
    orderId: string;
    paymentId: string;
    sessionId: string;
    products: string;
};

export const handlePaymentFailure = async ({ orderId, paymentId, sessionId, products }: HandlePaymentFailureInput) => {
    try {
        if(!orderId || !paymentId) {
            throw new Error("Invalid input");
        }

        paymentQueue.add(
            "payment_failed", 
            { id: paymentId, status: PaymentStatus.FAILED, orderId, products: JSON.parse(products) },
            {
                attempts: 3,
                backoff: {
                    type: "exponential",
                    delay: 1000,
                }
            }
        );
    } catch (err) {
        throw new Error(`Failed to handle payment failure: ${err}`);
    }
}