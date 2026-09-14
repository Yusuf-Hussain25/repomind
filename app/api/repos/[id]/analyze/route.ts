import { getRepo } from "@/lib/store";
import { runAnalyzePipeline } from "@/lib/analyze";
import { hasAccess } from "@/lib/access";
import {
  analyzeQueue,
  subscribeToJob,
  type StreamEvent,
} from "@/lib/queue";

export const runtime = "nodejs";
export const maxDuration = 300;

function sse(payload: StreamEvent): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

/**
 * Decide whether to use BullMQ (worker process is running) or fall back
 * to inline execution. Inline still works for dev without `npm run worker`.
 */
async function shouldUseQueue(): Promise<boolean> {
  try {
    const queue = analyzeQueue();
    const workers = await queue.getWorkers();
    return workers.length > 0;
  } catch {
    return false;
  }
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const repo = await getRepo(id);
  if (!repo) return new Response("Not found", { status: 404 });

  // Public demo: running the agents costs real money, so only the owner can
  // start an analysis. Sent as a stream event so the UI shows the message.
  if (!hasAccess(req)) {
    return new Response(
      sse({
        stage: "error",
        progress: 100,
        message: "Analysis is owner-only in the public demo. Try one of the analyzed repos on the dashboard.",
      }),
      { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } },
    );
  }

  const useQueue = await shouldUseQueue();

  let aborted = false;
  req.signal.addEventListener("abort", () => {
    aborted = true;
  });

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: StreamEvent) => {
        if (aborted) return;
        try {
          controller.enqueue(enc.encode(sse(event)));
        } catch {
          aborted = true;
        }
      };

      if (useQueue) {
        // Queue mode: hand the job off to the worker and tail its event
        // channel over Redis pub/sub.
        let teardown: (() => void) | null = null;
        try {
          const job = await analyzeQueue().add(
            "analyze",
            { repoId: repo.id },
            {
              removeOnComplete: { age: 3600 },
              removeOnFail: { age: 3600 },
            },
          );
          const jobId = String(job.id);

          send({
            stage: "queued",
            progress: 4,
            message: `Job ${jobId} enqueued — worker picking it up…`,
          });

          await new Promise<void>((resolve) => {
            teardown = subscribeToJob(jobId, (event) => {
              send(event);
              // ProgressEvent has `stage`; AgentEvent has `type`. Terminal
              // states only come through as ProgressEvent.
              if ("stage" in event && (event.stage === "complete" || event.stage === "error")) {
                resolve();
              }
            });
            req.signal.addEventListener("abort", () => resolve());
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Queue failed";
          send({ stage: "error", progress: 100, message });
        } finally {
          if (teardown) (teardown as () => void)();
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
        return;
      }

      // Inline fallback: run the pipeline synchronously inside the SSE.
      // Same behavior as before queues. Useful when no worker is running.
      try {
        await runAnalyzePipeline({
          repoId: repo.id,
          emit: send,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Analysis failed";
        send({ stage: "error", progress: 100, message });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      // Communicates which mode handled this request — useful for the UI
      // or for debugging without parsing the stream.
      "X-Analyze-Mode": useQueue ? "queue" : "inline",
    },
  });
}
