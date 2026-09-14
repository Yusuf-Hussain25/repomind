# RepoInsight — Roadmap & Progress Tracker

> Living document. Update checkboxes as we ship. New ideas go in **Backlog**.
> Goal: take this from a single-LLM-call repo summarizer to a **multi-agent
> AI system** that matches the resume claim — and looks like nothing else
> when demoed.

---

## The Resume Claim (what we're building toward)

> Built a multi-agent AI system that autonomously analyzes GitHub repositories
> — mapping architecture, summarizing modules, and answering code questions.
> - Agent orchestration with **LangChain + LangGraph**, **OpenAI function calling**
>   for tool use, **RAG** pipeline over code using **Pinecone** embeddings.
> - Streamed real-time agent progress to a **Next.js** UI; backed by **Node.js**
>   services with **Redis-backed agent memory** and **BullMQ** job queues.

Every bullet must be demonstrably true and visible in the UI.

---

## Current State (as of 2026-05-20)

| Layer       | Status | Notes |
|-------------|--------|-------|
| Frontend    | ✅ app shell | Sidebar + topbar + tabs scaffold, framer-motion transitions, Cmd+K palette, sonner toasts |
| LLM         | ✅ OpenAI-only | gpt-4o; Anthropic removed |
| Repo fetch  | ✅ works | `lib/github.ts` walks the tree, fetches text files |
| Analysis    | ✅ multi-agent | LangGraph 5-node DAG, parallel branches, streaming, token meter |
| Chat        | ✅ Tool-using | Full function-calling agent loop (`search_code`/`read_file`/`grep`/`list_directory`); animated tool-call cards inline. Replaces RAG-only stuffing. |
| Storage     | ⚠️ file-based | `lib/store.ts` writes JSON to disk. Fine for MVP. |
| Agents      | ✅ Phase 2 done | Planner, FileSelector, Architect, ConcernHunter, Synthesizer — see `lib/agents/` |
| RAG         | ✅ Phase 1 done | `lib/embed.ts` chunks (~800 tok, 100 overlap), embeds via `text-embedding-3-small`, upserts to Pinecone namespace per repo. Auto-creates serverless index. |
| Tools       | ✅ Phase 3 done | `lib/tools/` — 4 OpenAI function-calling tools. Architect, ConcernHunter, and Chat agents now use the tool loop (`streamCompletionWithTools`). |
| Queues      | ✅ Phase 4 done | BullMQ `analyze` queue + standalone worker. Analyze route enqueues a job and tails Redis pub/sub. Falls back to inline when no worker is registered. |
| Memory      | ✅ Redis-backed | Chat history persisted per `repoId` (last 20 turns, 7d TTL). UI hydrates on mount. `/jobs` page shows queue snapshot + recent jobs. |
| Queues      | ❌ none | Analyze blocks the SSE connection. |
| Memory      | ❌ none | Chat history lives only in browser state. |

---

## Frontend Vision — "people will blow their mind"

The multi-agent claim is only impressive if users can **see** the agents working.
Aim for a UI that feels like watching a heist movie, not reading a markdown doc.

### Hero layout: 3-pane "Mission Control"

```
┌─────────────────────────────────────────────────────────────┐
│  RepoInsight  ▸ owner/repo                       [⚙] [👤]   │
├──────────────┬─────────────────────────┬────────────────────┤
│              │                         │                    │
│  AGENT       │   LIVE OUTPUT           │   ARTIFACTS        │
│  GRAPH       │   (streaming)           │   - architecture   │
│              │                         │   - file tree      │
│  ● Planner   │   [Architect agent]     │   - mermaid diag   │
│  ● Selector  │   reading auth.ts...    │   - concerns       │
│  ◉ Architect │   ▍                     │   - chat           │
│  ○ Concerns  │                         │                    │
│  ○ Synth     │                         │                    │
│              │                         │                    │
└──────────────┴─────────────────────────┴────────────────────┘
```

### Mind-blowing details

- [ ] **Live agent graph** — nodes light up as they run; edges pulse on hand-off.
      Use SVG with CSS animations, not a heavy lib like reactflow unless needed.
- [ ] **Per-agent streaming panel** — each agent gets its own collapsible card
      with its live token stream, model used, tokens consumed, duration.
- [ ] **Tool-call cards** — when an agent calls `read_file('src/auth.ts')`,
      a small animated card slides in showing the call + result preview.
- [ ] **Replay mode** — scrub through the entire analysis run after it's done.
      Persist the event log so users can re-watch.
- [ ] **Command palette** (`Cmd+K`) — jump to any repo, file, agent run, chat.
- [ ] **Architecture diagram** — auto-generated Mermaid graph rendered live.
- [ ] **Confetti / pulse** when analysis completes. Earn the moment.
- [ ] **Sound design** — optional subtle ticks on agent transitions (mute by default).
- [ ] **Dark/light themes** with smooth transition. (Currently dark-only.)
- [ ] **Mobile-decent** — collapse panes into tabs under 768px.

### Visual language

- Existing glassmorphism stays. Sharpen it: more contrast on borders,
  subtle gradient backdrops per agent (each agent has a signature hue).
- Mono font for agent names + tool calls. Sans for prose.
- Motion: 200–300ms eases. Nothing bouncy. Confidence > cuteness.

---

## Cost-optimization principles (binding for all phases)

> Baked into the design from day one — every agent / route / chat call must
> respect these. The token meter in the UI is also a demo flex.

1. **Tiered models.** `gpt-4o-mini` for routing/selection/polish; `gpt-4o`
   only for agents that read source code (Architect, ConcernHunter).
2. **Two-stage funnel.** FileSelector cuts ~500 files → ~20 *before* the
   expensive agents see anything. ~25× input reduction.
3. **Selected files only.** Architect & ConcernHunter never receive the full
   repo dump — only the FileSelector output.
4. **Shared prefix → auto prompt cache.** Architect & ConcernHunter share the
   same selected-files prefix. OpenAI caches prefixes ≥1024 tokens with 50%
   discount on hits.
5. **Parallel independent nodes.** Architect ‖ ConcernHunter via concurrent
   edges. Same tokens, half wall-clock.
6. **`max_tokens` per node.** No runaway agent.
7. **Cache the final report.** `repo.status === 'ready'` short-circuits the graph.
8. **Token meter in UI.** Per-agent in/out tokens + USD. Visible budget control.
9. **RAG saves chat.** Phase 1 replaces full-repo-stuffing with top-K retrieval
   → ~90% chat savings on big repos.
10. **Embed once per repo.** Skip if already in Pinecone namespace.

## Phases

> Ship each phase end-to-end before starting the next. Each phase must be
> demoable on its own.

### Phase 0 — Baseline cleanup *(½ day)*

- [x] Remove Anthropic, OpenAI-only
- [x] Rename `lib/claude.ts` → `lib/prompts.ts`
- [ ] Move repo store from disk → Redis (groundwork for Phase 4)
- [ ] Add `/dashboard` route as the new landing for an analyzed repo

### Phase 1 — RAG with Pinecone *(1 day)*

> Why first: chat currently breaks on big repos because we stuff the whole
> codebase into the prompt. RAG fixes that AND becomes a tool the agents
> use later.

- [x] Add `@pinecone-database/pinecone` and `openai` embedding calls
- [x] `lib/embed.ts` — chunk files (≈800 tokens, 100 overlap), embed with
      `text-embedding-3-small`, upsert to Pinecone with metadata
      `{ path, chunkIdx, text }` — namespace per repo
- [x] On analyze completion, kick off embedding pass
- [x] Replace chat's full-context approach with `retrieveRelevantChunks(query, k=8)`
      (with graceful fallback to full-context when `PINECONE_API_KEY` absent or
      embeddings not ready)
- [x] UI: show "Retrieved N chunks from M files" pill above the answer
      *(hover for file list; click-to-expand can land later)*

**Demo win:** chat stays fast and accurate even on 1000-file repos.

### Phase 2 — LangGraph multi-agent analyzer *(2 days)* ⭐ HEADLINE ✅

> The most visible feature. Replaces one giant prompt with a graph of
> specialist agents that hand work to each other.

- [x] Add `@langchain/langgraph` + `@langchain/openai` + `@langchain/core`
- [x] `lib/agents/graph.ts` — 5 nodes:
  - [x] `Planner` (gpt-4o-mini) — reads manifest, writes 4–6 line strategy
  - [x] `FileSelector` (gpt-4o-mini) — picks 15–20 important files as JSON
  - [x] `Architect` (gpt-4o) — Purpose, Tech Stack, Architecture, Modules, Entry Points
  - [x] `ConcernHunter` (gpt-4o) — Notable Concerns with severity tags
  - [x] `Synthesizer` (gpt-4o-mini) — joins drafts, adds Getting Started
- [x] State via `Annotation.Root` with reducers (totalUsage sums across nodes)
- [x] Architect ‖ ConcernHunter run concurrently
- [x] `lib/agents/openai.ts` — streaming completion + token usage capture
- [x] `lib/agents/parse.ts` — slice context doc by selected file paths
- [x] SSE event union: `agent_start | agent_token | agent_done | graph_start | graph_done`
- [x] **Mission Control** 3-pane UI (`components/mission-control.tsx`)
- [x] Live agent graph SVG (`components/agent-graph.tsx`) with pulsing edges,
      glow filter, animated dash on active edges, checkmarks on done nodes
- [x] Per-agent streaming card with model name, token meter, $ cost, duration
- [x] Live meters panel (tokens in/out, cost, wall time)
- [x] Final report pane with sticky position
- [x] Removed legacy `analyze-stream.tsx`

**Demo win:** interviewer asks "is this really multi-agent?" → point at five
distinct agents with their own live streams, hues, models, and cost meters.

### Phase 2.7 — App Shell + Sections *(1 day)* ✅

> Big-project visual identity: persistent sidebar, topbar with breadcrumbs,
> command palette, page transitions. Re-frames the whole product.

- [x] Add `framer-motion`, `sonner`, `cmdk`
- [x] Route group `(app)` so app pages share a layout; landing page stays standalone
- [x] `components/shell/sidebar.tsx` — collapsible (localStorage-persisted),
      grouped nav, active-item pill animation via `layoutId`, model-tier card
- [x] `components/shell/topbar.tsx` — sticky breadcrumbs, "agents online" pulse,
      account avatar, `PageHeading` helper
- [x] `components/shell/command-palette.tsx` — `cmdk` palette, ⌘K global,
      backdrop blur, scaled enter animation
- [x] `components/shell/page-transition.tsx` — fade/slide on route change
- [x] `components/shell/icons.tsx` — centralised inline SVGs
- [x] Sonner `Toaster` mounted at root with glass styling
- [x] Dashboard upgrade: KPI row (repos, ready, in progress, files indexed),
      staggered card grid, hover lift
- [x] Repo page redundant breadcrumb removed (topbar handles it)
- [x] Landing page (`/`) gets its own minimal sticky header — no shell

**Demo win:** instantly reads as a real product, not a script with a UI on top.

### Phase 3 — Function-calling tools *(1 day)*

> Agents stop being "prompt + return text" and start being agents that
> reach for tools.

- [x] `lib/tools/` — define OpenAI function-calling tools:
  - `search_code(query: string)` — Pinecone semantic search
  - `read_file(path: string)` — full file contents
  - `list_directory(path: string)` — tree listing
  - `grep(pattern: string)` — literal text search
- [x] Wire tools into the `Architect` and `ConcernHunter` agents
- [x] Wire tools into the chat agent (replaces stuffing — full agent loop with tools)
- [x] UI: animated tool-call cards inline in the agent's stream
      *(rendered in both the chat bubble stream and Mission Control's per-agent cards)*

**Demo win:** chat answer cites specific files because the agent *fetched* them.

### Phase 4 — BullMQ + Redis *(1 day)*

> Production-feel. Analysis becomes a background job; multiple repos can run
> in parallel; chat memory survives reload.

- [x] `docker-compose.yml` for local Redis (port 6380 to avoid host-Redis collisions)
- [x] `lib/queue.ts` — BullMQ `analyze` queue + pub/sub helpers
      *(separate `embed` queue not yet needed — embedding runs as the last step of the analyze job)*
- [x] `lib/worker.ts` — standalone worker process; concurrency configurable via `WORKER_CONCURRENCY`
- [x] `npm run worker` script (plus `npm run infra:up`/`infra:down`/`infra:logs`)
- [x] Move analyze handler from SSE-blocking to job enqueue → SSE subscribes to job events
      *(graceful fallback to inline execution when no worker is registered, so dev without docker still works; `X-Analyze-Mode` response header reports which path served the request)*
- [x] Redis-backed chat memory per `repoId` (last 20 turns; UI hydrates on mount; `DELETE /api/repos/[id]/chat/history` clears)
- [x] Redis-backed event log per job (`job:<id>:log`, 24h TTL) — feeds /jobs and is the foundation for Phase 5 replay
- [x] `/jobs` page: BullMQ counts (active/waiting/delayed/completed/failed) + recent jobs table with status + duration + repo link

**Demo win:** "I can analyze 5 repos in parallel and watch them all live."

### Phase 5 — Polish & demo prep *(1 day)*

- [ ] Replay mode (scrub through a finished run from Redis event log)
- [ ] Command palette (`Cmd+K`)
- [ ] Mermaid architecture diagram in artifacts pane
- [ ] Loom-quality demo recording script
- [ ] Pre-seed 3 impressive public repos (Next.js, FastAPI, etc.) so a cold
      visitor sees something instantly
- [ ] README with architecture diagram + GIF of the agent graph running

---

## Backlog (cool but not on the critical path)

- Sound design on agent transitions
- Light theme
- "Compare two repos" mode
- Slack/Discord webhook on analysis complete
- GitHub App integration → auto-analyze on push
- LangSmith tracing for the agent graph
- Cost dashboard (tokens per agent per run)
- Public share links for finished analyses

---

## Decisions log

| Date       | Decision | Reason |
|------------|----------|--------|
| 2026-05-01 | OpenAI-only, drop Anthropic | User's Anthropic key was invalid; simplifying provider plumbing |
| 2026-05-01 | Rename `lib/claude.ts` → `lib/prompts.ts` | File only holds prompt strings now |
| 2026-05-01 | Phase 2 first (before RAG) | Multi-agent UI is the demo headline; current full-context approach works for medium repos as baseline |
| 2026-05-01 | Tiered models: mini for routing/polish, full 4o for code-reading agents | Cost-optimization principle #1; ~5× cheaper without losing quality |
| 2026-05-01 | Architect ‖ ConcernHunter via concurrent edges | Half wall-clock at same token cost; LangGraph fan-out from FileSelector |
| 2026-05-01 | Route group `(app)` for shell-wrapped pages | Clean separation between marketing/landing and the actual app surface |
| 2026-05-01 | framer-motion + sonner + cmdk | Industry-standard, small footprint, production polish without rolling our own |

---

## Open questions

- **Pinecone vs. local vector store?** Pinecone matches the resume; local
  (e.g., `lancedb`) is faster to set up and free. Decision: **Pinecone**, the
  resume claim wins.
- **gpt-4o everywhere or downgrade some agents to gpt-4o-mini?** Mini for
  Planner/FileSelector, full 4o for Architect/Synthesizer is the cost-sweet-spot.
- **Keep file-based store or full Redis migration?** Lean: keep files for repo
  metadata, use Redis for queues/memory/event-log only.
