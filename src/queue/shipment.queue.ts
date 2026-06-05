import { Queue } from "bullmq";

export const shipmentQueue = new Queue("shipmentQueue", {
    connection: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
    }
});