import { Job, Worker } from "bullmq";
import { OrderStatus, ShipmentStatus } from "../generated/prisma/enums.js";
import { prisma } from "../../lib/prismaClient.js";
import { shipmentQueue } from "../queue/shipment.queue.js";
import { createLogger } from "../../logger/logger.js";

const log = createLogger("shipmentWorker");

type ShipmentJobProduct = string | { productId: string };

function normalizeProductIds(products: ShipmentJobProduct[]): string[] {
    return products
        .map((product) => (typeof product === "string" ? product : product.productId))
        .filter((id): id is string => Boolean(id));
}

async function createShipment(orderId: string, products: string[], status: ShipmentStatus) {
    try {
        const shipment = await prisma.shipment.create({
            data: {
                orderId,
                products,
                status,
            },
        });
        log.info({ orderId, status, shipmentId: shipment.id }, "Shipment created");
        return shipment;
    } catch (err) {
        log.error({ err, orderId, status }, "Failed to create shipment");
        throw err;
    }
}

async function updateShipment(orderId: string, products: string[], status: ShipmentStatus) {
    try {
        await prisma.$transaction(async (tx) => {
            await tx.shipment.update({
                where: { orderId },
                data: { status },
            });

            switch (status) {
                case ShipmentStatus.PENDING:
                    await tx.orders.update({
                        where: { id: orderId },
                        data: { status: OrderStatus.SHIPPING_PENDING },
                    });
                    break;
                case ShipmentStatus.SHIPPED:
                    await tx.orders.update({
                        where: { id: orderId },
                        data: { status: OrderStatus.SHIPPING_COMPLETED },
                    });
                    break;
                case ShipmentStatus.DELIVERED:
                    await tx.orders.update({
                        where: { id: orderId },
                        data: { status: OrderStatus.COMPLETED },
                    });
                    break;
                default:
                    throw new Error("Invalid shipment status");
            }
        });
        log.info({ orderId, status }, "Shipment updated");
    } catch (err) {
        log.error({ err, orderId, status }, "Failed to update shipment");
        throw err;
    }
}

const shipmentWorker = new Worker(
    "shipmentQueue",
    async (job: { data: { orderId: string; products: ShipmentJobProduct[] }; name: string }) => {
        const { orderId, products } = job.data;
        const productIds = normalizeProductIds(products);
        const name = job.name;

        if (productIds.length === 0) {
            log.error({ jobName: name, orderId, products }, "Shipment job missing product IDs");
            throw new Error("Shipment job missing product IDs");
        }

        log.info({ jobName: name, orderId, productCount: productIds.length }, "Processing shipment job");

        try {
            switch (name) {
                case "start_shipment":
                    await createShipment(orderId, productIds, ShipmentStatus.PENDING);
                    await shipmentQueue.add(
                        "order_shipped",
                        { orderId, products },
                        { delay: 60 * 1000, attempts: 3, backoff: { type: "exponential", delay: 1000 } }
                    );
                    log.info({ orderId, jobName: name }, "Shipment started, order_shipped job scheduled");
                    break;
                case "order_shipped":
                    await updateShipment(orderId, productIds, ShipmentStatus.SHIPPED);
                    await shipmentQueue.add(
                        "order_delivered",
                        { orderId, products },
                        { delay: 120 * 1000, attempts: 3, backoff: { type: "exponential", delay: 1000 } }
                    );
                    log.info({ orderId, jobName: name }, "Order shipped, order_delivered job scheduled");
                    break;
                case "order_delivered":
                    await updateShipment(orderId, productIds, ShipmentStatus.DELIVERED);
                    log.info({ orderId, jobName: name }, "Order delivered");
                    break;
                default:
                    log.error({ jobName: name, orderId }, "Unknown shipment job name");
                    throw new Error("Invalid job name");
            }
        } catch (err) {
            log.error({ err, orderId, jobName: name }, "Shipment job processing failed");
            throw err;
        }
    },
    {
        connection: {
            host: process.env.REDIS_HOST,
            port: Number(process.env.REDIS_PORT),
        },
    }
);

shipmentWorker.on("completed", (job: Job) => {
    log.info({ jobName: job.name, orderId: job.data?.orderId }, "Shipment job completed");
});

shipmentWorker.on("failed", (job, err) => {
    log.error({ err, jobName: job?.name, orderId: job?.data?.orderId }, "Shipment job failed");
});

shipmentWorker.on("error", (err) => {
    log.error({ err }, "Shipment worker error");
});
