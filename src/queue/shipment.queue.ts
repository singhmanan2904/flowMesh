import { Queue } from "bullmq";
import { redisConnection } from "../../lib/redisConnection.js";

export const shipmentQueue = new Queue("shipmentQueue", {
    connection: redisConnection,
});