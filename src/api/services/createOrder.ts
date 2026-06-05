import type { PrismaClient } from "@prisma/client/extension";
import type { OrderStatus } from "../../generated/prisma/enums.js";
import type { Orders } from "../../generated/prisma/client.js";

export const createOrder = async (tx: PrismaClient, products: string[], totalAmount: number, userId: string, status: OrderStatus) => {
    try {
    return await tx.orders.create({
            data: {
                products,
                totalAmount,
                userId,
                status
            }
        }) as Orders;
    } catch (err) {
        console.error(`Error while creating order: ${err}`);
        throw err;
    }
}