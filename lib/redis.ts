// Shared ioredis client factory.
//
// BullMQ requires `maxRetriesPerRequest: null` on the connections used for
// queue/worker/pub-sub — without it, blocking commands like BLPOP get
// killed after the default retry count and the worker can wedge.

import IORedis, { type Redis } from "ioredis";

export const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6380";

let _shared: Redis | null = null;

/**
 * Long-lived client for normal commands (get/set/lpush). Single instance
 * shared across the process; reconnects automatically.
 */
export function getRedis(): Redis {
  if (!_shared) {
    _shared = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: false,
    });
    _shared.on("error", (err) => {
      // Don't crash on transient connection drops — ioredis will retry.
      console.error("[redis]", err.message);
    });
  }
  return _shared;
}

/**
 * Pub/sub requires its own connection — once a client enters subscribe
 * mode it can only run sub/unsub commands. Caller is responsible for
 * `.quit()`.
 */
export function newSubscriber(): Redis {
  const sub = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  sub.on("error", (err) => {
    console.error("[redis-sub]", err.message);
  });
  return sub;
}

export function isRedisConfigured(): boolean {
  // We always have a default, but treat an explicit empty string as "off"
  // so people can disable queues without code changes.
  return !!REDIS_URL && REDIS_URL.trim() !== "";
}
