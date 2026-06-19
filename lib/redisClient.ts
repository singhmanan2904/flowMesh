import "dotenv/config";
import { Redis } from "ioredis";

function createRedisClient(): Redis {
    if (process.env.REDIS_URL) {
        return new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
    }

    return new Redis({
        host: process.env.REDIS_HOST ?? "localhost",
        port: Number(process.env.REDIS_PORT ?? 6379),
        maxRetriesPerRequest: null,
    });
}

export const redisClient = createRedisClient();
