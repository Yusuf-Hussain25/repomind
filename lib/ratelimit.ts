// Fixed-window rate limiter on Redis.
//
// Fails closed: if Redis is unreachable the request is refused, because
// every allowed request in the public demo spends real OpenAI credit.

import { getRedis } from "./redis";

const REDIS_TIMEOUT_MS = 3000;

export interface LimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Redis timeout")), REDIS_TIMEOUT_MS),
    ),
  ]);
}

export async function hitLimit(
  bucket: string,
  limit: number,
  windowSec: number,
): Promise<LimitResult> {
  const key = `rl:${bucket}`;
  try {
    const r = getRedis();
    const count = await withTimeout(r.incr(key));
    let ttl = await withTimeout(r.ttl(key));
    // ttl -1 means the key exists without expiry (first hit, or a crash
    // between INCR and EXPIRE) — start the window now.
    if (ttl < 0) {
      await withTimeout(r.expire(key, windowSec));
      ttl = windowSec;
    }
    return {
      ok: count <= limit,
      remaining: Math.max(0, limit - count),
      retryAfterSec: ttl,
    };
  } catch (err) {
    console.error("[ratelimit]", err instanceof Error ? err.message : err);
    return { ok: false, remaining: 0, retryAfterSec: 60 };
  }
}

export function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}
