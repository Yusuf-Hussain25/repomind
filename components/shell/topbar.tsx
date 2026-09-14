"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { ChevronIcon, ZapIcon } from "./icons";
import { CommandPaletteTrigger } from "./command-palette";

interface Crumb {
  label: string;
  href?: string;
}

function buildCrumbs(pathname: string): Crumb[] {
  if (pathname === "/" || pathname === "/dashboard") {
    return [{ label: "Dashboard" }];
  }
  if (pathname.startsWith("/repo/")) {
    const id = pathname.split("/")[2] ?? "";
    // The id is owner_repo_uniq — just render the repo segment for breadcrumb.
    const parts = id.split("_");
    const label = parts.length >= 2 ? `${parts[0]}/${parts[1]}` : id;
    return [
      { label: "Dashboard", href: "/dashboard" },
      { label },
    ];
  }
  // Fallback: humanize the path.
  const segs = pathname.split("/").filter(Boolean);
  return segs.map((s) => ({ label: s.charAt(0).toUpperCase() + s.slice(1) }));
}

export function Topbar() {
  const pathname = usePathname();
  const crumbs = useMemo(() => buildCrumbs(pathname), [pathname]);

  return (
    <header className="sticky top-0 z-20 h-16 border-b border-[var(--border-muted)] bg-[var(--bg)]/85 backdrop-blur-xl">
      <div className="h-full px-6 flex items-center justify-between gap-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-2 min-w-0">
              {i > 0 && <ChevronIcon className="h-3.5 w-3.5 text-[var(--fg-faint)] shrink-0" />}
              {c.href ? (
                <Link
                  href={c.href}
                  className="text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors truncate"
                >
                  {c.label}
                </Link>
              ) : (
                <span className="text-[var(--fg)] font-medium truncate">{c.label}</span>
              )}
            </span>
          ))}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <CommandPaletteTrigger />
          <span className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-[var(--fg-faint)] uppercase tracking-wider">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-[var(--success)] animate-ping opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
            </span>
            agents online
          </span>
          <div className="h-6 w-px bg-[var(--border-muted)] hidden sm:block" />
          <button
            type="button"
            className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-gradient-to-br from-[var(--accent)] to-[#79b8ff] text-[#0d1117] font-semibold text-xs ring-1 ring-[var(--accent)]/40 hover:scale-105 transition-transform"
            aria-label="Account"
            title="Account"
          >
            Y
          </button>
        </div>
      </div>
    </header>
  );
}

export function PageHeading({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 mb-6 flex-wrap">
      <div className="min-w-0 flex items-start gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-soft)] border border-[var(--accent)]/30 text-[var(--accent)] shrink-0 mt-0.5">
          <ZapIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          {eyebrow && (
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--fg-faint)] mb-1">
              {eyebrow}
            </div>
          )}
          <h1 className="text-2xl font-semibold tracking-tight leading-tight">{title}</h1>
          {subtitle && <p className="text-sm text-[var(--fg-muted)] mt-1.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  );
}
