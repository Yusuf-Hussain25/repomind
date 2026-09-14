import Link from "next/link";
import { RepoForm } from "@/components/repo-form";
import { Logo, SparkleIcon, ZapIcon } from "@/components/shell/icons";

const FEATURES = [
  {
    title: "Multi-agent analyzer",
    body: "Five specialist LangGraph agents fan out across your repo and stream results in real time.",
    icon: <ZapIcon className="h-5 w-5" />,
  },
  {
    title: "Findings engine",
    body: "Structured improvement suggestions per file — security, performance, quality — each with a fix.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Chat over code",
    body: "Ask anything. RAG retrieval pulls only the most relevant chunks; answers cite real file paths.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 glass-strong border-b border-[var(--border-muted)]">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--accent)]/30 to-[var(--accent)]/5 border border-[var(--accent)]/40 text-[var(--accent)]">
              <Logo className="h-3.5 w-3.5" />
            </span>
            <span>RepoMind</span>
            <span className="text-[10px] font-mono text-[var(--fg-faint)] uppercase tracking-widest hidden sm:inline">
              · agents
            </span>
          </a>
          <nav className="text-sm text-[var(--fg-muted)] flex items-center gap-1">
            <Link
              href="/dashboard"
              className="px-3 py-1.5 rounded-md hover:bg-[var(--bg-soft)] hover:text-[var(--fg)] transition-colors"
            >
              Dashboard
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-md hover:bg-[var(--bg-soft)] hover:text-[var(--fg)] transition-colors"
            >
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-4xl w-full px-6 pt-24 pb-16 text-center flex flex-col items-center gap-6">
          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-[var(--accent)] glass rounded-full px-3 py-1.5">
            <SparkleIcon className="h-3 w-3" />
            Multi-agent · LangGraph · RAG
          </span>
          <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight bg-gradient-to-b from-white via-white to-[var(--fg-muted)] bg-clip-text text-transparent leading-[1.05]">
            Understand any GitHub repo<br />in minutes.
          </h1>
          <p className="text-lg text-[var(--fg-muted)] max-w-xl">
            Five autonomous agents map the architecture, surface risks, and answer
            questions across the codebase — streaming live to a mission-control UI.
          </p>
          <div className="w-full max-w-2xl glass glow rounded-2xl p-2 mt-2">
            <RepoForm />
          </div>
          <p className="text-xs text-[var(--fg-faint)]">
            Or explore an already-analyzed repo on the{" "}
            <Link href="/dashboard" className="text-[var(--fg-muted)] underline underline-offset-2 hover:text-[var(--accent)]">
              dashboard
            </Link>
            .
          </p>
        </section>

        <section className="mx-auto max-w-5xl w-full px-6 pb-20 grid sm:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="glass rounded-2xl p-5 hover:border-[var(--accent)]/40 hover:-translate-y-0.5 transition-all group"
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30 mb-4 group-hover:scale-110 transition-transform">
                {f.icon}
              </div>
              <h3 className="font-medium mb-1.5">{f.title}</h3>
              <p className="text-sm text-[var(--fg-muted)]">{f.body}</p>
            </div>
          ))}
        </section>

        <section className="mx-auto max-w-3xl w-full px-6 pb-24 text-center">
          <h2 className="text-2xl font-semibold mb-6 tracking-tight">How it works</h2>
          <ol className="grid sm:grid-cols-3 gap-4 text-sm text-[var(--fg-muted)]">
            {[
              "Paste a public GitHub URL.",
              "Five agents fan out: Planner → Selector → Architect ‖ ConcernHunter → Synthesizer.",
              "Stream the live agent graph; chat with the indexed code afterwards.",
            ].map((step, i) => (
              <li key={i} className="glass rounded-2xl p-5 text-left">
                <span className="block text-xs font-mono text-[var(--accent)] mb-2">
                  STEP / {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-[var(--fg)]">{step}</p>
              </li>
            ))}
          </ol>
          <p className="text-sm text-[var(--fg-muted)] mt-8">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg glass hover:border-[var(--accent)]/50 hover:text-[var(--accent)] transition-colors"
            >
              Open dashboard
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>
          </p>
        </section>
      </main>

      <footer className="border-t border-[var(--border-muted)] py-6 text-center text-xs text-[var(--fg-faint)]">
        Built with Next.js 16 · LangGraph · OpenAI
      </footer>
    </div>
  );
}
