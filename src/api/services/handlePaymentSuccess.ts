export type HandlePaymentSuccessInput = {
    orderId: string;
    paymentId: string;
    sessionId: string;
};

/**
 * Called from the Stripe webhook when checkout.session.completed fires.
 * Updates payment/order status and kicks off the shipment flow.
 */
export async function handlePaymentSuccess(
    _input: HandlePaymentSuccessInput
): Promise<void> {
    // TODO: update Payment → COMPLETED, Orders → PAYMENT_COMPLETED
    // TODO: enqueue shipmentQueue.add("order_placed", { orderId, products })
}
