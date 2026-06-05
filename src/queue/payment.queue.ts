import { Queue } from "bullmq";

export const paymentQueue = new Queue("paymentQueue", {
    connection: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
    }
});