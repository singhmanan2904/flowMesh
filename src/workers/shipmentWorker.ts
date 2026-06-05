import { Job, Worker } from "bullmq";
import { ShipmentStatus } from "../generated/prisma/enums.js";
import { prisma } from "../../lib/prismaClient.js";
import { shipmentQueue } from "../queue/shipment.queue.js";

async function createShipment(orderId: string, products: string[], status: ShipmentStatus) {
    try {
    const shipment = await prisma.shipment.create({
        data: {
            orderId,
            products,
            status,
        }
        });
        return shipment;
    } catch (err) {
        console.error(`Error while creating shipment: ${err}`);
        throw err;
    }
}

async function updateShipment(orderId: string, products: string[], status: ShipmentStatus) {
    try {
        const shipment = await prisma.shipment.update({
            where: { orderId },
            data: { status },
        });
    } catch (err) {
        console.error(`Error while updating shipment: ${err}`);
        throw err;
    }
}

const shipmentWorker = new Worker("shipmentQueue", async (job: {data: {orderId: string, products: string[]}, name: string}) => {
    try {
        const { orderId, products } = job.data;
        const name = job.name;
        switch (name) {
            case "order_placed":
                await createShipment(orderId, products, ShipmentStatus.PENDING);
                await shipmentQueue.add("order_shipped", {orderId, products}, {delay: 60 * 1000});
                console.log("order_placed job completed", job.data.orderId);
                break;
            case "order_shipped":
                await updateShipment(orderId, products, ShipmentStatus.SHIPPED);
                await shipmentQueue.add("order_delivered", {orderId, products}, {delay: 120 * 1000});
                console.log("order_shipped job completed", job.data.orderId);
                break;
            case "order_delivered":
                await updateShipment(orderId, products, ShipmentStatus.DELIVERED);
                console.log("order_delivered job completed", job.data.orderId);
                break;
            default:
                throw new Error("Invalid job name");
        }
        
    } catch (err) {
        console.log("error while creating shipments for order", job.data.orderId, err);
        throw err;
    }
}, {
    connection: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
    } 
});

shipmentWorker.on("completed", (job: Job) => {
    console.log("shipment worker completed job", job.name);
});

shipmentWorker.on("failed", (job, err) => {
    console.error("shipment worker failed job", job?.name, err);
});

shipmentWorker.on("error", (err) => {
    console.error("shipment worker error", err);
});