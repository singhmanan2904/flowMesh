import { redisClient } from "../../lib/redisClient.js";

/** Stripe retries webhooks for up to ~3 days; keep keys long enough to cover that window. */
const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Atomically claims an idempotency key. Returns true when this caller is the first to claim it.
 */
export async function claimIdempotencyKey(
    key: string,
    ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<boolean> {
    const result = await redisClient.set(`idempotency:${key}`, "1", "EX", ttlSeconds, "NX");
    return result === "OK";
}

/** Releases a claimed key so a retried operation can proceed after a handler failure. */
export async function releaseIdempotencyKey(key: string): Promise<void> {
    await redisClient.del(`idempotency:${key}`);
}
