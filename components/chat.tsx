"use client";

import { useEffect, useRef, useState } from "react";
import { Markdown } from "./markdown";
import type { ChatMessage } from "@/lib/types";

interface Props {
  repoId: string;
  ready: boolean;
}

interface ToolCallRecord {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  preview?: string;
  ok?: boolean;
  durationMs?: number;
}

interface UiMessage extends ChatMessage {
  toolCalls?: ToolCallRecord[];
}

const TOOL_ICONS: Record<string, string> = {
  search_code: "M",
  read_file: "F",
  list_directory: "L",
  grep: "G",
};

const TOOL_LABELS: Record<string, string> = {
  search_code: "search_code",
  read_file: "read_file",
  list_directory: "list_directory",
  grep: "grep",
};

function summarizeArgs(tool: string, args: Record<string, unknown>): string {
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

export function Chat({ repoId, ready }: Props) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Hydrate from Redis-backed chat memory on mount so a refresh doesn't
  // wipe history. Best-effort: if the endpoint or Redis is unavailable we
  // just start with an empty conversation.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/repos/${repoId}/chat/history`)
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data?.messages) && data.messages.length > 0) {
          setMessages(data.messages as UiMessage[]);
        }
      })
      .catch(() => {
        /* no persistence available; that's fine */
      });
    return () => {
      cancelled = true;
    };
  }, [repoId]);

  async function clearHistory() {
    if (streaming) return;
    try {
      await fetch(`/api/repos/${repoId}/chat/history`, { method: "DELETE" });
    } catch {
      /* best-effort */
    }
    setMessages([]);
    setError(null);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || streaming) return;
    setError(null);

    const next: UiMessage[] = [...messages, { role: "user", content: input.trim() }];
    setMessages(next);
    setInput("");
    setStreaming(true);

    setMessages((m) => [...m, { role: "assistant", content: "", toolCalls: [] }]);

    try {
      // Server only consumes role + content; strip UI-only fields.
      const wirePayload = next.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch(`/api/repos/${repoId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: wirePayload }),
      });
      if (!res.ok || !res.body) {
        const text = await res.text();
        throw new Error(text || "Chat request failed");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));
          if (data.type === "delta") {
            setMessages((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              copy[copy.length - 1] = {
                ...last,
                role: "assistant",
                content: last.content + data.text,
              };
              return copy;
            });
          } else if (data.type === "tool_call") {
            setMessages((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              const tc: ToolCallRecord = {
                id: data.toolCallId,
                tool: data.tool,
                args: data.args ?? {},
              };
              copy[copy.length - 1] = {
                ...last,
                role: "assistant",
                toolCalls: [...(last.toolCalls ?? []), tc],
              };
              return copy;
            });
          } else if (data.type === "tool_result") {
            setMessages((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              const updated = (last.toolCalls ?? []).map((tc) =>
                tc.id === data.toolCallId
                  ? {
                      ...tc,
                      preview: data.preview,
                      ok: data.ok,
                      durationMs: data.durationMs,
                    }
                  : tc,
              );
              copy[copy.length - 1] = {
                ...last,
                role: "assistant",
                toolCalls: updated,
              };
              return copy;
            });
          } else if (data.type === "error") {
            setError(data.message);
          }
        }
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat failed");
    } finally {
      setStreaming(false);
    }
  }

  const suggestions = [
    "How does authentication work?",
    "Where is the entry point?",
    "What are the key abstractions?",
  ];

  return (
    <div className="glass rounded-2xl flex flex-col h-[640px] overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] border border-[var(--accent)]/30 text-[var(--accent)] mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <p className="text-sm text-[var(--fg-muted)] mb-4">
              {ready ? "Ask anything about this repo." : "Waiting for analysis to finish…"}
            </p>
            {ready && (
              <div className="flex flex-col gap-1.5 w-full max-w-xs">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="text-xs text-left px-3 py-2 rounded-lg bg-[var(--bg-soft)]/50 border border-[var(--border-muted)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)] transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex flex-col items-start gap-1.5"}>
            {m.role === "assistant" && (m.toolCalls?.length ?? 0) > 0 && (
              <div className="flex flex-col gap-1 w-full max-w-[90%]">
                {m.toolCalls!.map((tc) => {
                  const pending = tc.preview === undefined;
                  const failed = tc.ok === false;
                  return (
                    <div
                      key={tc.id}
                      className={`tool-card flex items-start gap-2 text-[11px] rounded-lg border px-2.5 py-1.5 transition-colors ${
                        failed
                          ? "bg-[color-mix(in_srgb,var(--danger)_10%,var(--bg-soft))] border-[var(--danger)]/40 text-[var(--fg)]"
                          : pending
                            ? "bg-[var(--bg-soft)]/60 border-[var(--accent)]/40 text-[var(--fg-muted)]"
                            : "bg-[var(--bg-soft)]/60 border-[var(--border-muted)] text-[var(--fg-muted)]"
                      }`}
                    >
                      <span
                        className={`inline-flex items-center justify-center h-4 w-4 rounded text-[9px] font-bold shrink-0 ${
                          pending
                            ? "bg-[var(--accent)]/20 text-[var(--accent)] animate-pulse"
                            : failed
                              ? "bg-[var(--danger)]/20 text-[var(--danger)]"
                              : "bg-[var(--accent-soft)] text-[var(--accent)]"
                        }`}
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
                            {summarizeArgs(tc.tool, tc.args)}
                          </span>
                          {tc.durationMs !== undefined && (
                            <span className="text-[var(--fg-faint)] ml-auto shrink-0">
                              {tc.durationMs}ms
                            </span>
                          )}
                        </div>
                        {pending ? (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="h-1 w-1 rounded-full bg-[var(--accent)] animate-bounce [animation-delay:-0.3s]" />
                            <span className="h-1 w-1 rounded-full bg-[var(--accent)] animate-bounce [animation-delay:-0.15s]" />
                            <span className="h-1 w-1 rounded-full bg-[var(--accent)] animate-bounce" />
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
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-md bg-[var(--accent)] text-[#0d1117] px-4 py-2.5 text-sm font-medium shadow-[0_0_24px_-8px_rgba(88,166,255,0.6)]"
                  : "max-w-[90%] rounded-2xl rounded-bl-md bg-[var(--bg-soft)]/70 border border-[var(--border-muted)] px-4 py-2.5 text-sm text-[var(--fg)]"
              }
            >
              {m.role === "user" ? (
                <p className="whitespace-pre-wrap">{m.content}</p>
              ) : m.content ? (
                <Markdown source={m.content} />
              ) : (
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--fg-faint)] animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--fg-faint)] animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--fg-faint)] animate-bounce" />
                </div>
              )}
            </div>
          </div>
        ))}
        {error && (
          <div className="text-sm text-[var(--danger)] px-2">{error}</div>
        )}
      </div>
      <form
        onSubmit={send}
        className="border-t border-[var(--border-muted)] p-2.5 flex gap-2 bg-[var(--bg-elev)]/40"
      >
        <input
          type="text"
          placeholder={ready ? "Ask about this repo…" : "Analysis must finish first"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={!ready || streaming}
          className="flex-1 rounded-lg bg-[var(--bg-elev)] border border-[var(--border)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/30 px-3 py-2 text-sm text-[var(--fg)] placeholder-[var(--fg-faint)] outline-none disabled:opacity-50 transition-all"
        />
        <button
          type="submit"
          disabled={!ready || streaming || !input.trim()}
          className="rounded-lg bg-[var(--accent)] text-[#0d1117] px-3.5 py-2 text-sm font-semibold hover:bg-[#79b8ff] disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center"
          aria-label="Send"
        >
          {streaming ? (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity=".25" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
