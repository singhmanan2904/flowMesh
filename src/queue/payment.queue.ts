import { Queue } from "bullmq";
import { redisConnection } from "../../lib/redisConnection.js";

export const paymentQueue = new Queue("paymentQueue", {
    connection: redisConnection,
});
