import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../../lib/prismaClient.js";
import { createOrder } from "../services/createOrder.js";
import { OrderStatus, PaymentStatus } from "../../generated/prisma/enums.js";
import { createPayment } from "../services/createPayment.js";
import { initiatePayment } from "../services/initiatePayment.js";
import { calculateOrderTotal, ProductNotFoundError } from "../services/calculateOrderTotal.js";

export const getOrderController = async function (
    request: FastifyRequest<{
        Headers: {
            Authorization: string;
        };
    }>,
    reply: FastifyReply
) {
    const { userId } = request;
    try {
        request.log.info({ userId }, "Fetching orders for user");
        const orders = await prisma.orders.findMany({
            where: {
                userId,
            },
        });
        request.log.info({ userId, orderCount: orders.length }, "Orders fetched");
        return reply.code(200).send({ orders });
    } catch (err) {
        request.log.error({ err, userId }, "Failed to fetch orders");
        return reply.code(401).send({ message: "could not get orders for this user" });
    }
};

export const createOrderController = async function (
    request: FastifyRequest<{
        Body: {
            products: string[];
        };
        Headers: {
            Authorization: string;
        };
    }>,
    reply: FastifyReply
) {
    const { userId } = request;
    const { products } = request.body;

    request.log.info({ userId, productCount: products.length }, "Creating order");

    try {
        const totalAmount = await calculateOrderTotal(products);
        const { order, payment } = await prisma.$transaction(async (tx) => {
            const order = await createOrder(tx, products, totalAmount, userId, OrderStatus.PAYMENT_PENDING);
            const payment = await createPayment(tx, order.id, totalAmount, PaymentStatus.PENDING);
            return { order, payment };
        });

        const { paymentUrl, sessionId } = await initiatePayment({
            orderId: order.id,
            products,
            paymentId: payment.id,
            amount: totalAmount,
        });

        request.log.info(
            { userId, orderId: order.id, paymentId: payment.id, sessionId, totalAmount },
            "Order created with checkout session"
        );

        return reply.code(201).send({
            orderId: order.id,
            paymentId: payment.id,
            paymentUrl,
            sessionId,
        });
    } catch (err) {
        if (err instanceof ProductNotFoundError) {
            request.log.warn({ userId, productIds: err.productIds }, "Order creation failed: products not found");
            return reply.code(400).send({ message: err.message });
        }
        request.log.error({ err, userId, productCount: products.length }, "Failed to create order");
        return reply.code(403).send({ message: "Error while creating orders", error: err });
    }
};
