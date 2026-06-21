import { Job, Worker } from "bullmq";
import { prisma } from "../../lib/prismaClient.js";
import { redisConnection } from "../../lib/redisConnection.js";
import { OrderStatus, PaymentStatus } from "../generated/prisma/enums.js";
import { shipmentQueue } from "../queue/shipment.queue.js";
import { createLogger } from "../../logger/logger.js";

const log = createLogger("paymentWorker");

export const paymentWorker = new Worker(
    "paymentQueue",
    async (job: {
        data: { id: string; status: "PENDING" | "COMPLETED" | "FAILED"; orderId: string; products: string[] };
        name: string;
    }) => {
        const { id, status, orderId, products } = job.data;
        const name = job.name;

        log.info({ jobName: name, paymentId: id, orderId, status }, "Processing payment job");

        try {
            if (!id || !status) {
                log.error({ jobName: name, data: job.data }, "Invalid payment queue job data");
                throw new Error("Invalid payment queue job data");
            }

            switch (name) {
                case "payment_completed": {
                    const payment = await prisma.payment.findUnique({ where: { id } });
                    if (!payment) {
                        throw new Error(`Payment not found: ${id}`);
                    }
                    if (payment.status === PaymentStatus.COMPLETED) {
                        log.info({ jobName: name, paymentId: id, orderId }, "Payment already completed, skipping");
                        break;
                    }

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
                    log.info({ jobName: name, paymentId: id, orderId }, "Payment marked completed");

                    const existingShipment = await prisma.shipment.findUnique({ where: { orderId } });
                    if (existingShipment) {
                        log.info({ orderId, shipmentId: existingShipment.id }, "Shipment already exists, skipping enqueue");
                        break;
                    }

                    await shipmentQueue.add(
                        "start_shipment",
                        { orderId, products },
                        {
                            jobId: `start_shipment:${orderId}`,
                            attempts: 3,
                            backoff: {
                                type: "exponential",
                                delay: 1000,
                            },
                        }
                    );
                    log.info({ orderId, productCount: products.length }, "Start shipment job enqueued");
                    break;
                }
                case "payment_failed": {
                    const payment = await prisma.payment.findUnique({ where: { id } });
                    if (!payment) {
                        throw new Error(`Payment not found: ${id}`);
                    }
                    if (payment.status === PaymentStatus.FAILED) {
                        log.info({ jobName: name, paymentId: id, orderId }, "Payment already failed, skipping");
                        break;
                    }
                    if (payment.status === PaymentStatus.COMPLETED) {
                        log.info(
                            { jobName: name, paymentId: id, orderId },
                            "Payment already completed, ignoring failure job"
                        );
                        break;
                    }

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
                    log.info({ jobName: name, paymentId: id, orderId }, "Payment marked failed");
                    break;
                }
                default:
                    log.error({ jobName: name, paymentId: id, orderId }, "Unknown payment job name");
                    throw new Error("Invalid payment status in payment queue job");
            }
        } catch (err) {
            log.error({ err, jobName: name, paymentId: id, orderId }, "Payment job processing failed");
            throw err;
        }
    },
    {
        connection: redisConnection,
    }
);

paymentWorker.on("completed", (job: Job) => {
    log.info({ jobName: job.name, orderId: job.data?.orderId, paymentId: job.data?.id }, "Payment job completed");
});

paymentWorker.on("failed", (job, err) => {
    log.error({ err, jobName: job?.name, orderId: job?.data?.orderId, paymentId: job?.data?.id }, "Payment job failed");
});

paymentWorker.on("error", (err) => {
    log.error({ err }, "Payment worker error");
});
