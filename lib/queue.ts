// BullMQ queue for analysis jobs.
//
// One queue per work type: `analyze`. The HTTP route enqueues an
// AnalyzeJobData payload and listens on the job's pub/sub channel for
// real-time events from the worker. Events are JSON-encoded ProgressEvent
// or AgentEvent objects.

import { Queue } from "bullmq";
import IORedis from "ioredis";
import { REDIS_URL, getRedis, newSubscriber } from "./redis";
import type { AgentEvent } from "./agents/types";
import type { ProgressEvent } from "./types";

export type StreamEvent = ProgressEvent | AgentEvent;

export interface AnalyzeJobData {
  repoId: string;
}

let _analyzeQueue: Queue<AnalyzeJobData> | null = null;

// Connection is opened on first use, not at import, so routes and builds
// that never touch the queue don't open a Redis socket.
export function analyzeQueue(): Queue<AnalyzeJobData> {
  if (!_analyzeQueue) {
    const connection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    connection.on("error", (err) => console.error("[queue]", err.message));
    _analyzeQueue = new Queue<AnalyzeJobData>("analyze", { connection });
  }
  return _analyzeQueue;
}

/** Pub/sub channel for a specific job's event stream. */
export function jobChannel(jobId: string): string {
  return `job:${jobId}:events`;
}

/** Publish one event from the worker side. Best-effort — drops on error. */
export async function publishJobEvent(jobId: string, event: StreamEvent): Promise<void> {
  try {
    await getRedis().publish(jobChannel(jobId), JSON.stringify(event));
  } catch (err) {
    console.error("[queue] publish failed:", err instanceof Error ? err.message : err);
  }
}

/** Append the same event to a Redis list so /jobs replay can read it later. */
export async function logJobEvent(jobId: string, event: StreamEvent): Promise<void> {
  try {
    const key = `job:${jobId}:log`;
    const r = getRedis();
    await r.rpush(key, JSON.stringify(event));
    // 24h retention is enough for a demo replay.
    await r.expire(key, 60 * 60 * 24);
  } catch {
    // logging failure must never break the run
  }
}

export async function readJobLog(jobId: string): Promise<StreamEvent[]> {
  const raw = await getRedis().lrange(`job:${jobId}:log`, 0, -1);
  return raw.map((s) => JSON.parse(s) as StreamEvent);
}

/**
 * Subscribe to a job's event channel. Callback fires for every published
 * event. Returns a teardown function that unsubscribes and closes the
 * dedicated subscriber connection.
 */
export function subscribeToJob(
  jobId: string,
  onEvent: (e: StreamEvent) => void,
): () => void {
  const sub = newSubscriber();
  const channel = jobChannel(jobId);
  sub.subscribe(channel).catch((err) =>
    console.error("[queue] subscribe failed:", err instanceof Error ? err.message : err),
  );
  sub.on("message", (_ch, message) => {
    try {
      onEvent(JSON.parse(message) as StreamEvent);
    } catch {
      // skip malformed payloads
    }
  });
  return () => {
    sub.unsubscribe(channel).catch(() => {});
    sub.quit().catch(() => {});
  };
}
