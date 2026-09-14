"use client";

import { Command } from "cmdk";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { GridIcon, HomeIcon, PlusIcon, SearchIcon, SparkleIcon } from "./icons";

export function CommandPaletteTrigger() {
  const [open, setOpen] = useState(false);
  // Cmd/Ctrl+K opens the palette globally.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden sm:inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-[var(--border-muted)] bg-[var(--bg-elev)]/60 text-[var(--fg-faint)] hover:text-[var(--fg)] hover:border-[var(--border)] transition-colors min-w-[260px]"
      >
        <SearchIcon className="h-3.5 w-3.5" />
        <span className="text-xs flex-1 text-left">Search or jump…</span>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-soft)] border border-[var(--border-muted)]">
          ⌘K
        </span>
      </button>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
  );
}

function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const close = () => onOpenChange(false);
  const go = (href: string) => {
    close();
    router.push(href);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh] px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={close}
            aria-hidden
          />
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative w-full max-w-xl"
          >
            <Command
              label="Command Palette"
              className="glass-strong rounded-2xl overflow-hidden ring-1 ring-[var(--border)] shadow-[0_24px_80px_-20px_rgba(0,0,0,0.8)]"
            >
              <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--border-muted)]">
                <SearchIcon className="h-4 w-4 text-[var(--fg-faint)]" />
                <Command.Input
                  placeholder="Search or jump anywhere…"
                  className="flex-1 bg-transparent outline-none text-sm placeholder-[var(--fg-faint)]"
                  autoFocus
                />
                <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-soft)] border border-[var(--border-muted)] text-[var(--fg-faint)]">
                  ESC
                </kbd>
              </div>
              <Command.List className="max-h-[60vh] overflow-y-auto p-2">
                <Command.Empty className="px-4 py-8 text-center text-sm text-[var(--fg-faint)]">
                  No results.
                </Command.Empty>

                <Command.Group heading="Navigate" className="mb-2">
                  <PaletteItem
                    onSelect={() => go("/")}
                    icon={<HomeIcon className="h-4 w-4" />}
                    label="Go to home"
                    hint="/"
                  />
                  <PaletteItem
                    onSelect={() => go("/dashboard")}
                    icon={<GridIcon className="h-4 w-4" />}
                    label="Open dashboard"
                    hint="/dashboard"
                  />
                </Command.Group>

                <Command.Group heading="Actions">
                  <PaletteItem
                    onSelect={() => go("/")}
                    icon={<PlusIcon className="h-4 w-4" />}
                    label="Analyze a new repository"
                    hint="paste a GitHub URL"
                  />
                  <PaletteItem
                    onSelect={() => go("/dashboard")}
                    icon={<SparkleIcon className="h-4 w-4" />}
                    label="View recent analyses"
                  />
                </Command.Group>
              </Command.List>
              <div className="px-4 py-2 border-t border-[var(--border-muted)] flex items-center justify-between text-[10px] font-mono text-[var(--fg-faint)] uppercase tracking-wider">
                <span>RepoInsight palette</span>
                <span className="flex items-center gap-2">
                  <span>↑↓ navigate</span>
                  <span>↵ select</span>
                </span>
              </div>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PaletteItem({
  onSelect,
  icon,
  label,
  hint,
}: {
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
  hint?: string;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="group flex items-center gap-3 px-3 h-10 rounded-lg cursor-pointer text-sm text-[var(--fg-muted)] data-[selected=true]:bg-[var(--accent-soft)] data-[selected=true]:text-[var(--accent)]"
    >
      <span className="text-[var(--fg-faint)] group-data-[selected=true]:text-[var(--accent)]">
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {hint && (
        <span className="text-[10px] font-mono text-[var(--fg-faint)] truncate">{hint}</span>
      )}
    </Command.Item>
  );
}
