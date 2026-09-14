// Standalone BullMQ worker for analyze jobs.
//
// Run with `npm run worker`. Loads .env.local, opens a BullMQ Worker on the
// `analyze` queue, and for each job runs the full analyze pipeline,
// publishing every event to Redis pub/sub so the HTTP SSE handler can
// forward them to the browser.

import "./load-env";
import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { updateRepo } from "./store";
import { runAnalyzePipeline } from "./analyze";
import {
  type AnalyzeJobData,
  type StreamEvent,
  publishJobEvent,
  logJobEvent,
} from "./queue";
import { REDIS_URL } from "./redis";

const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Concurrency = 3 → satisfies the "5 repos in parallel" demo claim while
// keeping OpenAI rate-limit pressure sane.
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? "3");

async function processAnalyze(job: Job<AnalyzeJobData>): Promise<void> {
  const jobId = String(job.id);
  const repoId = job.data.repoId;

  const emit = (event: StreamEvent) => {
    publishJobEvent(jobId, event);
    logJobEvent(jobId, event);
  };

  try {
    await runAnalyzePipeline({ repoId, emit });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    await updateRepo(repoId, { status: "error", error: message }).catch(() => {});
    emit({ stage: "error", progress: 100, message });
    throw err; // mark BullMQ job as failed
  }
}

console.log(`[worker] starting analyze worker on ${REDIS_URL} (concurrency=${CONCURRENCY})`);

const worker = new Worker<AnalyzeJobData>("analyze", processAnalyze, {
  connection,
  concurrency: CONCURRENCY,
});

worker.on("ready", () => console.log("[worker] ready"));
worker.on("active", (job) => console.log(`[worker] active job=${job.id} repo=${job.data.repoId}`));
worker.on("completed", (job) => console.log(`[worker] completed job=${job.id}`));
worker.on("failed", (job, err) =>
  console.error(`[worker] failed job=${job?.id}: ${err.message}`),
);
worker.on("error", (err) => console.error("[worker] error:", err.message));

const shutdown = async () => {
  console.log("[worker] shutting down…");
  await worker.close();
  await connection.quit();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
