import {
    createCheckoutSession,
    type CreateCheckoutSessionResult,
} from "./paymentProvider.js";

export type InitiatePaymentInput = {
    orderId: string;
    paymentId: string;
    amount: number;
};

/**
 * Called synchronously from POST /orders after the order + payment rows are created.
 * Returns the payment URL the client should redirect the user to immediately.
 */
export async function initiatePayment(
    input: InitiatePaymentInput
): Promise<CreateCheckoutSessionResult> {
    // TODO: optionally persist sessionId on the Payment row before returning
    return createCheckoutSession(input);
}
