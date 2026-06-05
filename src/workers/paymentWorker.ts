import { Worker } from "bullmq";
import { prisma } from "../../lib/prismaClient.js";

const paymentWorker = new Worker("paymentQueue", async (job: {data: {id: string, status: "PENDING" | "COMPLETED" | "FAILED"}}) => {
    // IMPROVE THIS
    try {
    
    } catch (err) {
        console.log("error while creating payments table", err);
    }
}, {
    connection: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
    }
});