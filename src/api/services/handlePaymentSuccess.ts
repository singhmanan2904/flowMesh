import { prisma } from "../../../lib/prismaClient.js";
import { PaymentStatus } from "../../generated/prisma/enums.js";
import { paymentQueue } from "../../queue/payment.queue.js";

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
export async function handlePaymentSuccess(
    { orderId, paymentId, sessionId, products }: HandlePaymentSuccessInput
): Promise<void> {
    // TODO: update Payment → COMPLETED, Orders → PAYMENT_COMPLETED

    try {
        if(!orderId || !paymentId || !sessionId || !products) {
            throw new Error("Invalid input");
        }
        paymentQueue.add("payment_completed", { id: paymentId, status: PaymentStatus.COMPLETED, orderId, products: JSON.parse(products) });
    } catch (err) {
        throw new Error(`Failed to handle payment success: ${err}`);
    }
}
