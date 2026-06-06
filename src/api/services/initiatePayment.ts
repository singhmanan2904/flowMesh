import { prisma } from "../../../lib/prismaClient.js";
import {
    createCheckoutSession,
    type CheckoutLineItem,
    type CreateCheckoutSessionResult,
} from "./paymentProvider.js";
import { createLogger } from "../../../logger/logger.js";

const log = createLogger("initiatePayment");

export type InitiatePaymentInput = {
    orderId: string;
    products: string[];
    paymentId: string;
    amount: number;
};

function aggregateProductQuantities(productIds: string[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const id of productIds) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
}

async function resolveCheckoutLineItems(productIds: string[]): Promise<CheckoutLineItem[]> {
    const quantities = aggregateProductQuantities(productIds);
    const products = await prisma.product.findMany({
        where: { id: { in: [...quantities.keys()] } },
    });

    const priceById = new Map(products.map((product) => [product.id, product]));

    return [...quantities.entries()].map(([productId, quantity]) => {
        const product = priceById.get(productId);
        if (!product) {
            throw new Error(`Product not found: ${productId}`);
        }

        return {
            productId,
            name: productId,
            unitAmountCents: Math.round(product.price * 100),
            quantity,
            imageUrl: product.imageUrl,
        };
    });
}

/**
 * Called synchronously from POST /orders after the order + payment rows are created.
 * Returns the payment URL the client should redirect the user to immediately.
 */
export async function initiatePayment(input: InitiatePaymentInput): Promise<CreateCheckoutSessionResult> {
    log.info(
        { orderId: input.orderId, paymentId: input.paymentId, amount: input.amount, productCount: input.products.length },
        "Initiating payment"
    );

    const lineItems = await resolveCheckoutLineItems(input.products);

    return createCheckoutSession({
        orderId: input.orderId,
        paymentId: input.paymentId,
        amount: input.amount,
        lineItems,
    });
}
