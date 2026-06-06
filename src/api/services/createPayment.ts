import type { PrismaClient } from "@prisma/client/extension";
import type { PaymentStatus } from "../../generated/prisma/enums.js";
import type { Payment } from "../../generated/prisma/client.js";
import { createLogger } from "../../../logger/logger.js";

const log = createLogger("createPayment");

export const createPayment = async (tx: PrismaClient, orderId: string, amount: number, status: PaymentStatus) => {
    try {
        const payment = (await tx.payment.create({
            data: {
                orderId,
                status,
            },
        })) as Payment;
        log.info({ paymentId: payment.id, orderId, amount, status }, "Payment record created");
        return payment;
    } catch (err) {
        log.error({ err, orderId, amount, status }, "Failed to create payment record");
        throw err;
    }
};
