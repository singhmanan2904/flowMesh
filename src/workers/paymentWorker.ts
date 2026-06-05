import { Worker } from "bullmq";
import { prisma } from "../../lib/prismaClient.js";
import { OrderStatus, PaymentStatus } from "../generated/prisma/enums.js";
import { shipmentQueue } from "../queue/shipment.queue.js";

const paymentWorker = new Worker("paymentQueue", async (job: {data: {id: string, status: "PENDING" | "COMPLETED" | "FAILED", orderId: string, products: string[]}, name: string}) => {
    // IMPROVE THIS
    try {
        const { id, status, orderId, products } = job.data;
        if(!id || !status) {
            throw new Error("Invalid payment queue job data");
        }

        const name = job.name;
        switch (name) {
            case "payment_completed":
                await prisma.$transaction(async (tx) => {
                    await tx.payment.update({
                        where: { id },
                        data: { status: PaymentStatus.COMPLETED },
                    });
                    await tx.orders.update({
                        where: { id: orderId },
                        data: { status: OrderStatus.PAYMENT_COMPLETED },
                    });
                });
                await shipmentQueue.add("start_shipment", { orderId, products });
                break;
            case "payment_failed":
                await prisma.$transaction(async (tx) => {
                    await tx.payment.update({
                        where: { id },
                        data: { status: PaymentStatus.FAILED },
                    });
                    await tx.orders.update({
                        where: { id: orderId },
                        data: { status: OrderStatus.PAYMENT_FAILED },
                    });
                });
                break;
            default:
                throw new Error("Invalid payment status in payment queue job");
        }
    } catch (err) {
        console.log("error while creating payments table", err);
    }
}, {
    connection: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
    }
});