import type { ConnectionOptions } from "bullmq";

/**
 * BullMQ connection config for local Redis (REDIS_HOST/REDIS_PORT) or
 * Upstash / other managed Redis (REDIS_URL, e.g. rediss://default:...@....upstash.io:6379).
 */
export function getRedisConnection(): ConnectionOptions {
    if (process.env.REDIS_URL) {
        return {
            url: process.env.REDIS_URL,
            maxRetriesPerRequest: null,
        };
    }

    return {
        host: process.env.REDIS_HOST ?? "localhost",
        port: Number(process.env.REDIS_PORT ?? 6379),
        maxRetriesPerRequest: null,
    };
}

export const redisConnection = getRedisConnection();
