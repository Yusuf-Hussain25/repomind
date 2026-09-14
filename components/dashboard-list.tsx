"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { Repo } from "@/lib/types";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-[var(--bg-soft)] text-[var(--fg-muted)] border border-[var(--border)]",
  fetching: "bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30",
  analyzing: "bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30",
  ready: "bg-[#238636]/15 text-[var(--success)] border border-[var(--success)]/30",
  error: "bg-[#f85149]/10 text-[var(--danger)] border border-[var(--danger)]/30",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  fetching: "Fetching",
  analyzing: "Analyzing",
  ready: "Ready",
  error: "Error",
};

interface KpiItem {
  label: string;
  value: number | string;
  accent?: "default" | "success" | "accent" | "warn";
}

const ACCENT_STYLE: Record<string, string> = {
  default: "text-[var(--fg)]",
  success: "text-[var(--success)]",
  accent: "text-[var(--accent)]",
  warn: "text-[var(--warn)]",
};

export function KpiRow({ items }: { items: KpiItem[] }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.06 } },
      }}
      className="grid grid-cols-2 sm:grid-cols-4 gap-3"
    >
      {items.map((it) => (
        <motion.div
          key={it.label}
          variants={{
            hidden: { opacity: 0, y: 10 },
            show: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="glass rounded-2xl p-4"
        >
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--fg-faint)]">
            {it.label}
          </div>
          <div className={`text-3xl font-semibold tabular-nums mt-1 ${ACCENT_STYLE[it.accent ?? "default"]}`}>
            {it.value}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

export function DashboardGrid({ repos }: { repos: Repo[] }) {
  if (repos.length === 0) {
    return (
      <div className="glass rounded-2xl border-dashed p-16 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bg-soft)] border border-[var(--border)] text-[var(--fg-muted)] mb-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
          </svg>
        </div>
        <p className="text-[var(--fg-muted)]">No repositories yet.</p>
        <p className="text-sm text-[var(--fg-faint)] mt-1">Paste a GitHub URL above to get started.</p>
      </div>
    );
  }

  return (
    <motion.ul
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
      }}
      className="grid sm:grid-cols-2 gap-3"
    >
      {repos.map((r) => (
        <motion.li
          key={r.id}
          variants={{
            hidden: { opacity: 0, y: 12 },
            show: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          whileHover={{ y: -2 }}
        >
          <Link
            href={`/repo/${r.id}`}
            className="block glass rounded-2xl p-5 hover:border-[var(--accent)]/40 hover:bg-[var(--bg-soft)]/40 transition-colors h-full group"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent-soft)] border border-[var(--accent)]/30 text-[var(--accent)] shrink-0">
                <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                  <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 010-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 11-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8z" />
                </svg>
              </span>
              <span
                className={`text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  STATUS_STYLE[r.status] ?? STATUS_STYLE.pending
                } ${r.status === "fetching" || r.status === "analyzing" ? "animate-pulse" : ""}`}
              >
                {STATUS_LABEL[r.status] ?? r.status}
              </span>
            </div>
            <h2 className="font-medium truncate group-hover:text-[var(--accent)] transition-colors">
              {r.owner}
              <span className="text-[var(--fg-faint)]">/</span>
              {r.name}
            </h2>
            <p className="text-sm text-[var(--fg-muted)] truncate mt-1">
              {r.description ?? r.url}
            </p>
            <div className="flex items-center gap-3 text-xs text-[var(--fg-faint)] mt-3 font-mono flex-wrap">
              {r.language && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                  {r.language}
                </span>
              )}
              {typeof r.stars === "number" && <span>★ {r.stars}</span>}
              {r.fileCount && <span>{r.fileCount} files</span>}
            </div>
          </Link>
        </motion.li>
      ))}
    </motion.ul>
  );
}
