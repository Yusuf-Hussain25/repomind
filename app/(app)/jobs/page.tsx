// Queue status page — shows BullMQ counts and a table of recent analyze jobs.
//
// Server component: hits Redis directly via the queue helpers. If the
// queue is unreachable (no docker, REDIS_URL unset), renders an empty-state
// pointing the user at the worker setup.

import Link from "next/link";
import { analyzeQueue, type AnalyzeJobData } from "@/lib/queue";
import { getRepo } from "@/lib/store";
import type { Job } from "bullmq";

export const dynamic = "force-dynamic";

type JobStatus = "active" | "waiting" | "delayed" | "completed" | "failed";

interface JobRow {
  id: string;
  status: JobStatus;
  repoId: string;
  repoLabel: string;
  createdAt: number;
  finishedAt: number | null;
  durationMs: number | null;
  failedReason?: string;
}

async function loadSnapshot(): Promise<{
  counts: Record<JobStatus, number> | null;
  jobs: JobRow[];
  error?: string;
}> {
  try {
    const queue = analyzeQueue();
    const rawCounts = await queue.getJobCounts(
      "active",
      "waiting",
      "delayed",
      "completed",
      "failed",
    );
    const counts: Record<JobStatus, number> = {
      active: rawCounts.active ?? 0,
      waiting: rawCounts.waiting ?? 0,
      delayed: rawCounts.delayed ?? 0,
      completed: rawCounts.completed ?? 0,
      failed: rawCounts.failed ?? 0,
    };

    const jobs: (Job<AnalyzeJobData> | undefined)[] = (
      await Promise.all([
        queue.getJobs(["active"], 0, 9, false),
        queue.getJobs(["waiting", "delayed"], 0, 9, true),
        queue.getJobs(["completed"], 0, 9, false),
        queue.getJobs(["failed"], 0, 9, false),
      ])
    ).flat();

    const rows: JobRow[] = [];
    for (const j of jobs) {
      if (!j) continue;
      const state = (await j.getState()) as JobStatus;
      const repoId = j.data?.repoId ?? "?";
      const repo = await getRepo(repoId).catch(() => null);
      const repoLabel = repo ? `${repo.owner}/${repo.name}` : repoId;
      rows.push({
        id: String(j.id),
        status: state,
        repoId,
        repoLabel,
        createdAt: j.timestamp,
        finishedAt: j.finishedOn ?? null,
        durationMs:
          j.finishedOn && j.processedOn ? j.finishedOn - j.processedOn : null,
        failedReason: j.failedReason,
      });
    }
    rows.sort((a, b) => (b.finishedAt ?? b.createdAt) - (a.finishedAt ?? a.createdAt));

    return { counts, jobs: rows.slice(0, 30) };
  } catch (err) {
    return {
      counts: null,
      jobs: [],
      error: err instanceof Error ? err.message : "Queue unreachable",
    };
  }
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.max(1, Math.round(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
}

function formatMs(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const STATUS_HUES: Record<JobStatus, string> = {
  active: "var(--accent)",
  waiting: "#a371f7",
  delayed: "#ffa657",
  completed: "var(--success)",
  failed: "var(--danger)",
};

export default async function JobsPage() {
  const { counts, jobs, error } = await loadSnapshot();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Jobs</h1>
        <p className="text-sm text-[var(--fg-muted)] mt-1">
          BullMQ <code className="font-mono">analyze</code> queue. Worker process picks up
          enqueued jobs in the background and streams events back to the
          browser over Redis pub/sub.
        </p>
      </header>

      {error && (
        <div className="glass rounded-2xl p-5 border-[var(--danger)]/40 bg-[#f85149]/8">
          <div className="text-sm font-semibold text-[var(--danger)] mb-1">
            Queue unreachable
          </div>
          <p className="text-xs text-[var(--fg-muted)] mb-2">{error}</p>
          <p className="text-xs text-[var(--fg-muted)]">
            Start it with{" "}
            <code className="font-mono bg-[var(--bg-soft)] px-1.5 py-0.5 rounded">
              npm run infra:up
            </code>{" "}
            then{" "}
            <code className="font-mono bg-[var(--bg-soft)] px-1.5 py-0.5 rounded">
              npm run worker
            </code>
            . Without a worker the app falls back to inline analyze.
          </p>
        </div>
      )}

      {counts && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {(Object.keys(counts) as JobStatus[]).map((status) => (
            <div key={status} className="glass rounded-xl p-3.5">
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: STATUS_HUES[status] }}
                />
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--fg-faint)]">
                  {status}
                </span>
              </div>
              <div className="text-2xl font-semibold tabular-nums">
                {counts[status]}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border-muted)] flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--fg-faint)] font-semibold">
            Recent jobs
          </span>
          <span className="text-[11px] font-mono text-[var(--fg-faint)]">
            {jobs.length} shown
          </span>
        </div>
        {jobs.length === 0 ? (
          <div className="p-5 text-sm text-[var(--fg-muted)] italic">
            No jobs yet. Trigger one by analyzing a repo from{" "}
            <Link href="/dashboard" className="text-[var(--accent)] hover:underline">
              the dashboard
            </Link>
            .
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-[0.18em] text-[var(--fg-faint)] font-mono">
              <tr>
                <th className="px-5 py-2 text-left">Job</th>
                <th className="px-5 py-2 text-left">Repo</th>
                <th className="px-5 py-2 text-left">Status</th>
                <th className="px-5 py-2 text-left">Duration</th>
                <th className="px-5 py-2 text-left">When</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr
                  key={j.id}
                  className="border-t border-[var(--border-muted)] hover:bg-[var(--bg-soft)]/40 transition-colors"
                >
                  <td className="px-5 py-2.5 font-mono text-xs text-[var(--fg-muted)]">
                    {j.id}
                  </td>
                  <td className="px-5 py-2.5">
                    <Link
                      href={`/repo/${j.repoId}`}
                      className="text-[var(--fg)] hover:text-[var(--accent)] transition-colors"
                    >
                      {j.repoLabel}
                    </Link>
                  </td>
                  <td className="px-5 py-2.5">
                    <span
                      className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{
                        color: STATUS_HUES[j.status],
                        background: `${STATUS_HUES[j.status]}1f`,
                      }}
                      title={j.failedReason}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: STATUS_HUES[j.status] }}
                      />
                      {j.status}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 font-mono text-xs text-[var(--fg-muted)]">
                    {formatMs(j.durationMs)}
                  </td>
                  <td className="px-5 py-2.5 text-xs text-[var(--fg-muted)]">
                    {formatRelative(j.finishedAt ?? j.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
