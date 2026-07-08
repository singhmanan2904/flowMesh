import type { ConnectionOptions } from "bullmq";

/**
 * BullMQ connection config for local Redis (REDIS_HOST/REDIS_PORT) or
 * Upstash / other managed Redis (REDIS_URL, e.g. rediss://default:...@....upstash.io:6379).
 */
function connectionFromUrl(redisUrl: string): ConnectionOptions {
    const url = new URL(redisUrl);

    return {
        host: url.hostname,
        port: url.port ? Number(url.port) : 6379,
        ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
        ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
        ...(url.protocol === "rediss:" ? { tls: {} } : {}),
        maxRetriesPerRequest: null,
    };
}

export function getRedisConnection(): ConnectionOptions {
    if (process.env.REDIS_URL) {
        return connectionFromUrl(process.env.REDIS_URL);
    }

    return {
        host: process.env.REDIS_HOST ?? "localhost",
        port: Number(process.env.REDIS_PORT ?? 6379),
        maxRetriesPerRequest: null,
    };
}

export const redisConnection = getRedisConnection();
