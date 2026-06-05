import Stripe from "stripe";

export type CreateCheckoutSessionInput = {
    orderId: string;
    paymentId: string;
    amount: number;
};

export type CreateCheckoutSessionResult = {
    paymentUrl: string;
    sessionId: string;
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

/**
 * Stripe adapter — creates a Checkout Session and returns the hosted payment URL.
 * No DB access here; keep this as pure external I/O.
 */
export async function createCheckoutSession(
    _input: CreateCheckoutSessionInput
): Promise<CreateCheckoutSessionResult> {
    try {
    const checkoutSession = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [],
        mode: "payment",
        success_url: `${process.env.FRONTEND_URL}/success`,
        cancel_url: `${process.env.FRONTEND_URL}/cancel`,
    });
    return {
        paymentUrl: checkoutSession.url || "",
        sessionId: checkoutSession.id,
        };
    } catch (error) {
        console.error("Error while creating checkout session", error);
        throw error;
    }
}
