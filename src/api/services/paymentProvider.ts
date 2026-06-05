import Stripe from "stripe";

export type CheckoutLineItem = {
    productId: string;
    name: string;
    unitAmountCents: number;
    quantity: number;
    imageUrl?: string;
};

export type CreateCheckoutSessionInput = {
    orderId: string;
    paymentId: string;
    amount: number;
    lineItems: CheckoutLineItem[];
};

export type CreateCheckoutSessionResult = {
    paymentUrl: string;
    sessionId: string;
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Stripe adapter — creates a Checkout Session and returns the hosted payment URL.
 * No DB access here; line items must be resolved before calling this.
 */
export async function createCheckoutSession(
    input: CreateCheckoutSessionInput
): Promise<CreateCheckoutSessionResult> {
    if (input.lineItems.length === 0) {
        throw new Error("Cannot create checkout session without line items");
    }

    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";

    try {
        const checkoutSession = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: input.lineItems.map((item) => ({
                price_data: {
                    currency: "usd",
                    unit_amount: item.unitAmountCents,
                    product_data: {
                        name: item.name,
                        ...(item.imageUrl ? { images: [item.imageUrl] } : {}),
                        metadata: {
                            productId: item.productId,
                        },
                    },
                },
                quantity: item.quantity,
            })),
            mode: "payment",
            success_url: `${frontendUrl}/success?session_id={CHECKOUT_SESSION_ID}&order_id=${input.orderId}`,
            cancel_url: `${frontendUrl}/cancel?order_id=${input.orderId}`,
            metadata: {
                orderId: input.orderId,
                paymentId: input.paymentId,
            },
        });

        if (!checkoutSession.url) {
            throw new Error("Stripe checkout session did not return a payment URL");
        }

        return {
            paymentUrl: checkoutSession.url,
            sessionId: checkoutSession.id,
        };
    } catch (error) {
        console.error("Error while creating checkout session", error);
        throw error;
    }
}
