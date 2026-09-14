"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ActivityIcon,
  AgentIcon,
  GridIcon,
  Logo,
  PanelIcon,
  SettingsIcon,
  ShieldIcon,
  SparkleIcon,
  ZapIcon,
} from "./icons";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: GridIcon, badge: null as null | string },
  { href: "/jobs", label: "Jobs", icon: ZapIcon, badge: null as null | string },
  { href: "/agents", label: "Agents", icon: AgentIcon, badge: "5", soon: true },
  { href: "/findings", label: "Findings", icon: ShieldIcon, badge: null, soon: true },
  { href: "/activity", label: "Activity", icon: ActivityIcon, badge: null, soon: true },
] as const;

const SECONDARY_ITEMS = [
  { href: "/settings", label: "Settings", icon: SettingsIcon, soon: true },
] as const;

const STORAGE_KEY = "ri.sidebar.collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  // Hydrate the saved collapsed state on mount. We render expanded by default
  // and only flip if the user previously collapsed it — avoids a layout flash.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "1") setCollapsed(true);
    } catch {
      /* localStorage unavailable */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ type: "spring", stiffness: 280, damping: 30 }}
      className="shrink-0 sticky top-0 h-screen border-r border-[var(--border-muted)] bg-[var(--bg-elev)]/40 backdrop-blur-xl flex flex-col z-30"
    >
      <div className="h-16 px-4 flex items-center gap-2.5 border-b border-[var(--border-muted)]">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent)]/30 to-[var(--accent)]/5 border border-[var(--accent)]/40 text-[var(--accent)] shrink-0">
          <Logo className="h-4 w-4" />
        </span>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            className="min-w-0"
          >
            <div className="text-sm font-semibold tracking-tight leading-tight">RepoInsight</div>
            <div className="text-[10px] font-mono text-[var(--fg-faint)] uppercase tracking-widest">
              v0.2 · agents
            </div>
          </motion.div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <NavGroup label={collapsed ? null : "Workspace"}>
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={isActive(item.href)}
              collapsed={collapsed}
              badge={item.badge}
              soon={"soon" in item ? item.soon : false}
            />
          ))}
        </NavGroup>

        <NavGroup label={collapsed ? null : "Account"}>
          {SECONDARY_ITEMS.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={isActive(item.href)}
              collapsed={collapsed}
              soon={item.soon}
            />
          ))}
        </NavGroup>
      </nav>

      <div className={`border-t border-[var(--border-muted)] ${collapsed ? "px-2 py-3" : "p-3"} space-y-2`}>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass rounded-xl p-3 text-xs"
          >
            <div className="flex items-center gap-2 text-[var(--fg)] font-medium">
              <SparkleIcon className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span>GPT-4o · 4o-mini</span>
            </div>
            <p className="text-[var(--fg-faint)] mt-1 leading-snug">
              Tiered model routing keeps the average analysis under $0.05.
            </p>
          </motion.div>
        )}

        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="w-full flex items-center justify-center gap-2 h-9 rounded-lg border border-[var(--border-muted)] text-[var(--fg-faint)] hover:text-[var(--fg)] hover:border-[var(--border)] transition-colors text-xs font-mono"
          title={collapsed ? "Expand" : "Collapse"}
        >
          <PanelIcon className={`h-3.5 w-3.5 transition-transform ${collapsed ? "rotate-180" : ""}`} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </motion.aside>
  );
}

function NavGroup({ label, children }: { label: string | null; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      {label && (
        <div className="px-3 mb-2 text-[10px] font-semibold tracking-[0.18em] text-[var(--fg-faint)] uppercase">
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

function NavItem({
  href,
  icon: Icon,
  label,
  active,
  collapsed,
  badge,
  soon,
}: {
  href: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  label: string;
  active: boolean;
  collapsed: boolean;
  badge?: string | null;
  soon?: boolean;
}) {
  const inner = (
    <span
      className={`relative flex items-center gap-3 h-10 rounded-lg px-3 transition-colors group ${
        active
          ? "bg-[var(--accent-soft)] text-[var(--accent)]"
          : "text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-soft)]/50"
      }`}
      title={collapsed ? label : undefined}
    >
      {active && (
        <motion.span
          layoutId="active-pill"
          className="absolute inset-0 rounded-lg ring-1 ring-[var(--accent)]/40"
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
        />
      )}
      <span className="relative shrink-0">
        <Icon className="h-4 w-4" />
      </span>
      {!collapsed && (
        <>
          <span className="relative text-sm font-medium truncate flex-1">{label}</span>
          {badge && !soon && (
            <span className="relative text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[var(--accent)]/20 text-[var(--accent)]">
              {badge}
            </span>
          )}
          {soon && (
            <span className="relative text-[9px] font-mono uppercase tracking-wider text-[var(--fg-faint)]">
              soon
            </span>
          )}
        </>
      )}
    </span>
  );
  if (soon) {
    return <span className="block opacity-60 cursor-not-allowed">{inner}</span>;
  }
  return <Link href={href}>{inner}</Link>;
}
