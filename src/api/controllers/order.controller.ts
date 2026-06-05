import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../../lib/prismaClient.js";
import { createOrder } from "../services/createOrder.js";
import { OrderStatus, PaymentStatus } from "../../generated/prisma/enums.js";
import { createPayment } from "../services/createPayment.js";
import { initiatePayment } from "../services/initiatePayment.js";

export const getOrderController = async function (request: FastifyRequest<{
    Headers: {
        Authorization: string
    }
}>, reply: FastifyReply) { 
    try {
        request.log.info(`GET request processing for orders: ${request}`);
        const orders = await prisma.orders.findMany({
            where: {
                userId: request.userId
            }
        });
        return reply.code(200).send({orders});
    } catch (err) {
        request.log.info(`Error in getting orders for: ${request}`);
        return reply.code(401).send({message: "could not get orders for this user"});
    }
}

export const createOrderController = async function (request: FastifyRequest<{
    Body: {
        products: string[],
        totalAmount: number,
    },
    Headers: {
        Authorization: string
    }
}>, reply: FastifyReply) {
    request.log.info(`POST request processing for orders: ${request}`);
    try {
        const { products, totalAmount } = request.body;
        const { order, payment } = await prisma.$transaction(async (tx) => {
            //creating the order first
            const order = await createOrder(tx, products, totalAmount, request.userId, OrderStatus.PAYMENT_PENDING);
            //creating the payment
            const payment = await createPayment(tx, order.id, totalAmount, PaymentStatus.PENDING);
            return { order, payment };
        });

        const { paymentUrl, sessionId } = await initiatePayment({
            orderId: order.id,
            paymentId: payment.id,
            amount: totalAmount,
        });

        return reply.code(201).send({
            orderId: order.id,
            paymentId: payment.id,
            paymentUrl,
            sessionId,
        });
    } catch (err) {
        request.log.error(`Error while creating orders, ${err}`);
        return reply.code(403).send({message: "Error while creating orders", error: err});
    }
}