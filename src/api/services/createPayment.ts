import type { PrismaClient } from "@prisma/client/extension";
import type { PaymentStatus } from "../../generated/prisma/enums.js";
import type { Payment } from "../../generated/prisma/client.js";

export const createPayment = async (tx: PrismaClient, orderId: string, amount: number, status: PaymentStatus) => {
    try {
    return await tx.payment.create({
        data: {
            orderId,
                status
            }
        }) as Payment;
    } catch (err) {
        console.error(`Error while creating payment: ${err}`);
        throw err;
    }
}