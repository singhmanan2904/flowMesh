import type { PrismaClient } from "@prisma/client/extension";
import type { OrderStatus } from "../../generated/prisma/enums.js";
import type { Orders } from "../../generated/prisma/client.js";
import { createLogger } from "../../../logger/logger.js";

const log = createLogger("createOrder");

export const createOrder = async (
    tx: PrismaClient,
    products: string[],
    totalAmount: number,
    userId: string,
    status: OrderStatus
) => {
    try {
        const order = (await tx.orders.create({
            data: {
                products,
                totalAmount,
                userId,
                status,
            },
        })) as Orders;
        log.info({ orderId: order.id, userId, totalAmount, productCount: products.length, status }, "Order created");
        return order;
    } catch (err) {
        log.error({ err, userId, totalAmount, productCount: products.length, status }, "Failed to create order");
        throw err;
    }
};
