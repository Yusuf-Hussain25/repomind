"use client";

import { useEffect, useMemo, useState } from "react";
import { Markdown } from "./markdown";
import { AgentGraph } from "./agent-graph";
import { AGENT_ORDER, AGENTS, AgentName, AgentStatus, TokenUsage } from "@/lib/agents/types";

interface Props {
  repoId: string;
  initialAnalysis?: string;
  initialStatus?: string;
}

interface ToolCallRecord {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  preview?: string;
  ok?: boolean;
  durationMs?: number;
}

interface AgentRow {
  status: AgentStatus;
  text: string;
  toolCalls: ToolCallRecord[];
  usage?: TokenUsage;
  durationMs?: number;
  startedAt?: number;
}

const TOOL_LABELS: Record<string, string> = {
  search_code: "search_code",
  read_file: "read_file",
  list_directory: "list_directory",
  grep: "grep",
};

const TOOL_ICONS: Record<string, string> = {
  search_code: "M",
  read_file: "F",
  list_directory: "L",
  grep: "G",
};

function summarizeToolArgs(tool: string, args: Record<string, unknown>): string {
  switch (tool) {
    case "search_code":
      return typeof args.query === "string" ? `"${args.query}"` : "";
    case "read_file":
    case "list_directory":
      return typeof args.path === "string" ? args.path : "";
    case "grep":
      return typeof args.pattern === "string" ? `"${args.pattern}"` : "";
    default:
      return JSON.stringify(args);
  }
}

const FETCH_STAGES = ["queued", "fetching_meta", "fetching_tree", "fetching_files"] as const;

const FETCH_LABELS: Record<string, string> = {
  queued: "Queued",
  fetching_meta: "Fetching repository metadata",
  fetching_tree: "Walking the repo tree",
  fetching_files: "Fetching source files",
  analyzing: "Agents working",
  complete: "Complete",
  error: "Error",
};

function emptyAgents(): Record<AgentName, AgentRow> {
  return AGENT_ORDER.reduce((acc, name) => {
    acc[name] = { status: "pending", text: "", toolCalls: [] };
    return acc;
  }, {} as Record<AgentName, AgentRow>);
}

// Cost estimate per 1M tokens (USD). Used for the live meter — not billing-grade.
const PRICING: Record<string, { in: number; out: number }> = {
  "gpt-4o": { in: 2.5, out: 10 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
};

function costOf(model: string, usage?: TokenUsage): number {
  if (!usage) return 0;
  const p = PRICING[model] ?? { in: 1, out: 3 };
  return (usage.input * p.in + usage.output * p.out) / 1_000_000;
}

export function MissionControl({ repoId, initialAnalysis, initialStatus }: Props) {
  const [agents, setAgents] = useState<Record<AgentName, AgentRow>>(emptyAgents);
  const [active, setActive] = useState<AgentName | null>(null);
  const [stage, setStage] = useState<string>(initialStatus === "ready" ? "complete" : "queued");
  const [progress, setProgress] = useState<number>(initialStatus === "ready" ? 100 : 0);
  const [fetchMessage, setFetchMessage] = useState<string>("");
  const [finalReport, setFinalReport] = useState<string>(initialAnalysis ?? "");
  const [error, setError] = useState<string | null>(null);
  const [totalUsage, setTotalUsage] = useState<TokenUsage>({ input: 0, output: 0 });
  const [graphStartedAt, setGraphStartedAt] = useState<number | null>(null);
  const [graphDoneAt, setGraphDoneAt] = useState<number | null>(null);

  const isAlreadyDone = initialStatus === "ready" && Boolean(initialAnalysis);
  const isStreaming = !isAlreadyDone && stage !== "complete" && stage !== "error";

  useEffect(() => {
    if (isAlreadyDone) return;

    let cancelled = false;
    const es = new EventSource(`/api/repos/${repoId}/analyze`);

    es.onmessage = (e) => {
      if (cancelled) return;
      let data: unknown;
      try {
        data = JSON.parse(e.data);
      } catch {
        return;
      }
      if (!data || typeof data !== "object") return;
      const evt = data as Record<string, unknown>;

      // Fetch-stage progress events
      if (typeof evt.stage === "string" && FETCH_STAGES.includes(evt.stage as never)) {
        setStage(evt.stage);
        if (typeof evt.progress === "number") setProgress(evt.progress);
        if (typeof evt.message === "string") setFetchMessage(evt.message);
        return;
      }
      if (evt.stage === "analyzing") {
        setStage("analyzing");
        if (typeof evt.progress === "number") setProgress(evt.progress);
        if (typeof evt.message === "string") setFetchMessage(evt.message);
        return;
      }
      if (evt.stage === "complete") {
        setStage("complete");
        setProgress(100);
        es.close();
        return;
      }
      if (evt.stage === "error") {
        setStage("error");
        setError((evt.message as string) ?? "Analysis failed");
        es.close();
        return;
      }

      // Agent events
      if (evt.type === "graph_start") {
        setGraphStartedAt((evt.ts as number) ?? Date.now());
        return;
      }
      if (evt.type === "graph_done") {
        setGraphDoneAt((evt.ts as number) ?? Date.now());
        if (typeof evt.finalReport === "string") setFinalReport(evt.finalReport);
        if (evt.totalUsage) setTotalUsage(evt.totalUsage as TokenUsage);
        return;
      }
      if (evt.type === "agent_start" && typeof evt.agent === "string") {
        const name = evt.agent as AgentName;
        setActive(name);
        setAgents((a) => ({ ...a, [name]: { ...a[name], status: "running", startedAt: (evt.ts as number) ?? Date.now() } }));
        return;
      }
      if (evt.type === "agent_token" && typeof evt.agent === "string") {
        const name = evt.agent as AgentName;
        const text = (evt.text as string) ?? "";
        setAgents((a) => ({ ...a, [name]: { ...a[name], text: a[name].text + text } }));
        return;
      }
      if (evt.type === "agent_done" && typeof evt.agent === "string") {
        const name = evt.agent as AgentName;
        setAgents((a) => ({
          ...a,
          [name]: {
            ...a[name],
            status: "done",
            usage: (evt.usage as TokenUsage) ?? a[name].usage,
            durationMs: (evt.durationMs as number) ?? undefined,
          },
        }));
        // Clear active highlight after a beat (parallel agents may overlap)
        setActive((cur) => (cur === name ? null : cur));
        return;
      }
      if (evt.type === "agent_error" && typeof evt.agent === "string") {
        const name = evt.agent as AgentName;
        setAgents((a) => ({ ...a, [name]: { ...a[name], status: "error" } }));
        setError((evt.message as string) ?? "Agent failed");
        return;
      }
      if (evt.type === "tool_call" && typeof evt.agent === "string") {
        const name = evt.agent as AgentName;
        if (!AGENT_ORDER.includes(name)) return;
        const tc: ToolCallRecord = {
          id: String(evt.toolCallId ?? ""),
          tool: String(evt.tool ?? ""),
          args: (evt.args as Record<string, unknown>) ?? {},
        };
        setAgents((a) => ({
          ...a,
          [name]: { ...a[name], toolCalls: [...a[name].toolCalls, tc] },
        }));
        return;
      }
      if (evt.type === "tool_result" && typeof evt.agent === "string") {
        const name = evt.agent as AgentName;
        if (!AGENT_ORDER.includes(name)) return;
        const callId = String(evt.toolCallId ?? "");
        setAgents((a) => ({
          ...a,
          [name]: {
            ...a[name],
            toolCalls: a[name].toolCalls.map((tc) =>
              tc.id === callId
                ? {
                    ...tc,
                    preview: String(evt.preview ?? ""),
                    ok: Boolean(evt.ok),
                    durationMs: typeof evt.durationMs === "number" ? evt.durationMs : undefined,
                  }
                : tc,
            ),
          },
        }));
        return;
      }
    };

    es.onerror = () => {
      es.close();
    };
    return () => {
      cancelled = true;
      es.close();
    };
  }, [repoId, isAlreadyDone]);

  const statuses = useMemo<Record<AgentName, AgentStatus>>(() => {
    const out = {} as Record<AgentName, AgentStatus>;
    for (const name of AGENT_ORDER) out[name] = agents[name].status;
    return out;
  }, [agents]);

  const totalCost = useMemo(() => {
    let sum = 0;
    for (const name of AGENT_ORDER) {
      const meta = AGENTS[name];
      sum += costOf(meta.model, agents[name].usage);
    }
    return sum;
  }, [agents]);

  const elapsedMs = graphStartedAt ? (graphDoneAt ?? Date.now()) - graphStartedAt : 0;

  return (
    <div className="grid lg:grid-cols-[260px_1fr_minmax(0,520px)] gap-5">
      {/* Left: Agent graph + meters */}
      <aside className="space-y-4">
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--fg-faint)] font-semibold">
              Agent graph
            </span>
            {isStreaming && active && (
              <span className="text-[10px] font-mono text-[var(--accent)]">
                {AGENTS[active].label}…
              </span>
            )}
          </div>
          <AgentGraph statuses={statuses} active={active} />
        </div>

        <div className="glass rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--fg-faint)] font-semibold">
              Live meters
            </span>
          </div>
          <Meter label="Tokens in" value={totalUsage.input.toLocaleString()} />
          <Meter label="Tokens out" value={totalUsage.output.toLocaleString()} />
          <Meter label="Cost" value={`$${totalCost.toFixed(4)}`} />
          <Meter label="Wall time" value={formatMs(elapsedMs)} />
        </div>

        {!isStreaming && finalReport && (
          <div className="glass rounded-2xl p-4 text-xs text-[var(--fg-muted)]">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--fg-faint)] font-semibold block mb-1">
              Status
            </span>
            <span className="inline-flex items-center gap-1.5 text-[var(--success)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
              Analysis complete
            </span>
          </div>
        )}
      </aside>

      {/* Middle: Per-agent stream */}
      <main className="space-y-4 min-w-0">
        {isStreaming && progress < 60 && (
          <FetchProgressCard stage={stage} progress={progress} message={fetchMessage} />
        )}
        {AGENT_ORDER.map((name) => (
          <AgentCard key={name} name={name} row={agents[name]} />
        ))}
        {error && (
          <div className="glass rounded-xl border-[var(--danger)]/40 bg-[#f85149]/10 p-4 text-sm text-[var(--danger)]">
            {error}
          </div>
        )}
      </main>

      {/* Right: Final artifact */}
      <aside className="min-w-0">
        <div className="sticky top-4 space-y-4">
          <div className="glass rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border-muted)] flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--fg-faint)] font-semibold">
                Final report
              </span>
              {finalReport && (
                <span className="text-[10px] font-mono text-[var(--success)] flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                  ready
                </span>
              )}
            </div>
            <div className="p-5 max-h-[70vh] overflow-y-auto">
              {finalReport ? (
                <Markdown source={finalReport} />
              ) : (
                <p className="text-sm text-[var(--fg-faint)] italic">
                  The Synthesizer will assemble the final report here once the
                  upstream agents finish.
                </p>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Meter({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] text-[var(--fg-faint)] font-mono uppercase tracking-wider">{label}</span>
      <span className="text-sm text-[var(--fg)] font-mono tabular-nums">{value}</span>
    </div>
  );
}

function FetchProgressCard({ stage, progress, message }: { stage: string; progress: number; message: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2 gap-3">
        <span className="flex items-center gap-2.5 text-sm font-medium min-w-0">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
          </span>
          <span className="truncate">{FETCH_LABELS[stage] ?? stage}</span>
        </span>
        <span className="text-xs text-[var(--fg-faint)] font-mono shrink-0">{progress}%</span>
      </div>
      <div className="h-1 w-full rounded-full bg-[var(--bg-soft)] overflow-hidden">
        <div className="h-full shimmer rounded-full transition-all" style={{ width: `${Math.max(progress, 4)}%` }} />
      </div>
      {message && <p className="text-xs text-[var(--fg-faint)] mt-2 font-mono truncate">{message}</p>}
    </div>
  );
}

function AgentCard({ name, row }: { name: AgentName; row: AgentRow }) {
  const meta = AGENTS[name];
  const cost = costOf(meta.model, row.usage);
  const isRunning = row.status === "running";
  const isDone = row.status === "done";
  const isError = row.status === "error";

  return (
    <div
      className="glass rounded-2xl overflow-hidden transition-all"
      style={{
        borderColor: isRunning || isDone ? `${meta.hue}55` : undefined,
        boxShadow: isRunning ? `0 0 32px -8px ${meta.hue}66` : undefined,
      }}
    >
      <header className="px-4 py-3 border-b border-[var(--border-muted)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{
              background: isError ? "var(--danger)" : meta.hue,
              boxShadow: isRunning ? `0 0 12px ${meta.hue}` : undefined,
              opacity: row.status === "pending" ? 0.35 : 1,
            }}
          />
          <span className="text-sm font-semibold truncate" style={{ color: row.status === "pending" ? "var(--fg-faint)" : "var(--fg)" }}>
            {meta.label}
          </span>
          <span className="text-[10px] font-mono text-[var(--fg-faint)] uppercase tracking-wider">{meta.model}</span>
          {isRunning && (
            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: meta.hue }}>
              ▌running
            </span>
          )}
          {isDone && (
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--success)]">
              ✓ done
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-[var(--fg-faint)] shrink-0">
          {row.usage && (
            <>
              <span title="input/output tokens">
                {row.usage.input}↓ {row.usage.output}↑
              </span>
              <span title="cost estimate">${cost.toFixed(4)}</span>
            </>
          )}
          {row.durationMs !== undefined && <span>{formatMs(row.durationMs)}</span>}
        </div>
      </header>
      <div className="px-4 py-3">
        <p className="text-[11px] text-[var(--fg-faint)] mb-2 italic">{meta.blurb}</p>
        {row.toolCalls.length > 0 && (
          <div className="flex flex-col gap-1 mb-2">
            {row.toolCalls.map((tc) => {
              const pending = tc.preview === undefined;
              const failed = tc.ok === false;
              return (
                <div
                  key={tc.id}
                  className={`tool-card flex items-start gap-2 text-[11px] rounded-lg border px-2.5 py-1.5 ${
                    failed
                      ? "bg-[color-mix(in_srgb,var(--danger)_10%,var(--bg-soft))] border-[var(--danger)]/40"
                      : "bg-[var(--bg-soft)]/60 border-[var(--border-muted)]"
                  }`}
                  style={
                    pending
                      ? { borderColor: `${meta.hue}55` }
                      : undefined
                  }
                >
                  <span
                    className={`inline-flex items-center justify-center h-4 w-4 rounded text-[9px] font-bold shrink-0 ${
                      pending ? "animate-pulse" : ""
                    }`}
                    style={{
                      background: failed ? "var(--danger)" : `${meta.hue}33`,
                      color: failed ? "white" : meta.hue,
                    }}
                    aria-hidden
                  >
                    {TOOL_ICONS[tc.tool] ?? "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-semibold text-[var(--fg)]">
                        {TOOL_LABELS[tc.tool] ?? tc.tool}
                      </span>
                      <span className="font-mono text-[var(--fg-muted)] truncate">
                        {summarizeToolArgs(tc.tool, tc.args)}
                      </span>
                      {tc.durationMs !== undefined && (
                        <span className="text-[var(--fg-faint)] ml-auto shrink-0">
                          {tc.durationMs}ms
                        </span>
                      )}
                    </div>
                    {pending ? (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="h-1 w-1 rounded-full animate-bounce [animation-delay:-0.3s]" style={{ background: meta.hue }} />
                        <span className="h-1 w-1 rounded-full animate-bounce [animation-delay:-0.15s]" style={{ background: meta.hue }} />
                        <span className="h-1 w-1 rounded-full animate-bounce" style={{ background: meta.hue }} />
                      </div>
                    ) : (
                      <div className="text-[var(--fg-muted)] truncate" title={tc.preview}>
                        ↳ {tc.preview}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {row.text ? (
          <pre
            className={`text-xs whitespace-pre-wrap leading-relaxed text-[var(--fg-muted)] font-mono max-h-56 overflow-y-auto ${isRunning ? "caret" : ""}`}
          >
            {row.text}
          </pre>
        ) : (
          <p className="text-xs text-[var(--fg-faint)] italic">
            {row.status === "pending" ? "Waiting…" : "Streaming…"}
          </p>
        )}
      </div>
    </div>
  );
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
