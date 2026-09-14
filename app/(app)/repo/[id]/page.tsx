import { notFound } from "next/navigation";
import { getRepo } from "@/lib/store";
import { MissionControl } from "@/components/mission-control";
import { Chat } from "@/components/chat";
import { formatBytes } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RepoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repo = await getRepo(id);
  if (!repo) notFound();

  const ready = repo.status === "ready" && Boolean(repo.analysis);

  return (
    <div className="mx-auto max-w-[1500px] w-full px-6 py-8">
      <header className="glass rounded-2xl p-6 mb-8">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0 flex items-start gap-4">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-soft)] border border-[var(--accent)]/30 text-[var(--accent)] shrink-0">
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-5 w-5">
                <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 010-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 11-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8z" />
              </svg>
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight">
                <span className="text-[var(--fg-muted)]">{repo.owner}</span>
                <span className="text-[var(--fg-faint)] mx-1">/</span>
                <span>{repo.name}</span>
              </h1>
              {repo.description && (
                <p className="text-[var(--fg-muted)] mt-1.5">{repo.description}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-[var(--fg-faint)] mt-3 flex-wrap">
                <a
                  href={repo.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-[var(--accent)] transition-colors font-mono text-xs"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M7.775 3.275a.75.75 0 001.06 1.06l1.25-1.25a2 2 0 112.83 2.83l-2.5 2.5a2 2 0 01-2.83 0 .75.75 0 00-1.06 1.06 3.5 3.5 0 004.95 0l2.5-2.5a3.5 3.5 0 00-4.95-4.95l-1.25 1.25zm-4.69 9.64a2 2 0 010-2.83l2.5-2.5a2 2 0 012.83 0 .75.75 0 001.06-1.06 3.5 3.5 0 00-4.95 0l-2.5 2.5a3.5 3.5 0 004.95 4.95l1.25-1.25a.75.75 0 00-1.06-1.06l-1.25 1.25a2 2 0 01-2.83 0z" />
                  </svg>
                  {repo.url.replace("https://", "")}
                </a>
                {repo.language && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                    {repo.language}
                  </span>
                )}
                {typeof repo.stars === "number" && <span>★ {repo.stars.toLocaleString()}</span>}
                {repo.fileCount && (
                  <span className="font-mono text-xs">
                    {repo.fileCount} files · {formatBytes(repo.totalBytes ?? 0)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <section>
        <SectionLabel>Mission control</SectionLabel>
        <MissionControl
          repoId={repo.id}
          initialAnalysis={repo.analysis}
          initialStatus={repo.status}
        />
      </section>

      <div className="grid lg:grid-cols-[1fr_380px] gap-6 mt-8">
        <section>
          <SectionLabel>Chat with the repo</SectionLabel>
          <Chat repoId={repo.id} ready={ready} />
        </section>

        {repo.topFiles && repo.topFiles.length > 0 && (
          <aside>
            <SectionLabel>Top files indexed</SectionLabel>
            <ul className="glass rounded-xl divide-y divide-[var(--border-muted)] text-xs font-mono overflow-hidden">
              {repo.topFiles.map((f) => (
                <li key={f.path} className="px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-[var(--bg-soft)]/40 transition-colors">
                  <span className="truncate text-[var(--fg-muted)]">{f.path}</span>
                  <span className="text-[var(--fg-faint)] shrink-0">{formatBytes(f.size)}</span>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--fg-faint)] mb-3 flex items-center gap-2">
      <span className="h-px flex-none w-4 bg-[var(--border)]" />
      {children}
    </h2>
  );
}
