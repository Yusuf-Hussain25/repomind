# RepoInsight — Complete Implementation Plan

**Version:** 1.0
**Date:** 2026-03-26
**Timeline:** 16 weeks (4 months)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Database Schema](#4-database-schema)
5. [API Design](#5-api-design)
6. [Agent System Architecture](#6-agent-system-architecture)
7. [Phase 1 — Foundation & Auth (Week 1-2)](#phase-1--foundation--auth-week-1-2)
8. [Phase 2 — Repository Ingestion Pipeline (Week 3-4)](#phase-2--repository-ingestion-pipeline-week-3-4)
9. [Phase 3 — Agentic AI Core (Week 5-8)](#phase-3--agentic-ai-core-week-5-8)
10. [Phase 4 — Interactive Chat Agent (Week 9-10)](#phase-4--interactive-chat-agent-week-9-10)
11. [Phase 5 — Frontend Dashboard (Week 11-12)](#phase-5--frontend-dashboard-week-11-12)
12. [Phase 6 — PR Assistant & GitHub Integration (Week 13-14)](#phase-6--pr-assistant--github-integration-week-13-14)
13. [Phase 7 — Production Polish (Week 15-16)](#phase-7--production-polish-week-15-16)
14. [Testing Strategy](#testing-strategy)
15. [Deployment Architecture](#deployment-architecture)
16. [Environment Variables](#environment-variables)
17. [Day 1 — Getting Started](#day-1--getting-started)

---

## 1. Architecture Overview

### High-Level System Architecture

```
                         ┌─────────────────────────────────┐
                         │        USER'S BROWSER            │
                         │   Next.js 16 (React 19 + RSC)    │
                         └────────────┬────────────────────┘
                                      │ HTTPS
                         ┌────────────▼────────────────────┐
                         │        VERCEL (Edge + Node)       │
                         │                                   │
                         │  ┌─────────────────────────────┐  │
                         │  │   Next.js App (Frontend +    │  │
                         │  │   API Route Handlers +       │  │
                         │  │   Server Actions)            │  │
                         │  └──────────┬──────────────────┘  │
                         │             │                      │
                         └─────────────┼──────────────────────┘
                                       │
              ┌────────────────────────┼─────────────────────────┐
              │                        │                         │
    ┌─────────▼──────────┐   ┌────────▼──────────┐   ┌─────────▼──────────┐
    │   Supabase         │   │   Upstash Redis    │   │   Railway Worker   │
    │   (PostgreSQL)     │   │   (Cache + Queue)  │   │   (BullMQ)         │
    │                    │   │                    │   │                    │
    │   Users            │   │   Job Queue        │   │   ┌──────────────┐│
    │   Repositories     │   │   Agent Memory     │   │   │ Agent        ││
    │   Analyses         │   │   Rate Limits      │   │   │ Orchestrator ││
    │   Conversations    │   │   Analysis Cache   │   │   │ (LangGraph)  ││
    │   Agent Runs       │   │                    │   │   └──────┬───────┘│
    │   Agent Steps      │   │                    │   │          │        │
    └────────────────────┘   └────────────────────┘   │   ┌──────▼───────┐│
                                                      │   │ Specialized  ││
    ┌────────────────────┐   ┌────────────────────┐   │   │ Agents:      ││
    │   Pinecone         │   │   OpenAI API       │   │   │ • Architect  ││
    │   (Vector DB)      │   │                    │   │   │ • Bug Hunter ││
    │                    │   │   GPT-4o (agents)  │   │   │ • Doc Writer ││
    │   Code embeddings  │◄──┤   GPT-4o-mini     │◄──┤   │ • Refactor   ││
    │   Repo insights    │   │   (simple tasks)   │   │   │ • Chat       ││
    │                    │   │                    │   │   └──────────────┘│
    │   Per-repo         │   │   text-embedding-  │   │                    │
    │   namespaces       │   │   3-small          │   │   Agent Tools:     │
    │                    │   │   (embeddings)     │   │   • file_read      │
    └────────────────────┘   └────────────────────┘   │   • vector_search  │
                                                      │   • ast_parse      │
    ┌────────────────────┐                            │   • dep_graph      │
    │   LangSmith        │◄───────────────────────────│   • github_api     │
    │   (LLM Tracing)    │                            │   • git_blame      │
    └────────────────────┘                            └────────────────────┘
```

### Request Flow: URL Submission → Analysis Complete

```
User pastes GitHub URL
    │
    ▼
Next.js Server Action: submitRepository()
    │
    ├── 1. Validate URL format (Zod)
    ├── 2. Check repo accessibility (GitHub API with user's token)
    ├── 3. Create Repository record (Prisma → PostgreSQL)
    ├── 4. Enqueue ingestion job (BullMQ → Redis)
    ├── 5. Return repoId + SSE endpoint URL
    │
    ▼
Railway Worker picks up job from BullMQ
    │
    ├── Stage 1: CLONING
    │   ├── git clone --depth 1
    │   ├── Emit SSE: { stage: "cloning", progress: 25 }
    │   └── Update DB: status = CLONING
    │
    ├── Stage 2: PARSING
    │   ├── Walk file tree (skip node_modules, .git, binaries)
    │   ├── Detect language per file (extension + tree-sitter)
    │   ├── Extract AST: functions, classes, imports, exports
    │   ├── Build dependency graph
    │   ├── Detect tech stack
    │   ├── Emit SSE: { stage: "parsing", progress: 50, fileCount: 342 }
    │   └── Update DB: status = PARSING
    │
    ├── Stage 3: EMBEDDING
    │   ├── Smart semantic chunking (function/class/module boundaries)
    │   ├── Batch embed via OpenAI (100 chunks per batch)
    │   ├── Upsert to Pinecone (namespace: repoId)
    │   ├── Emit SSE: { stage: "embedding", progress: 75 }
    │   └── Update DB: status = EMBEDDING
    │
    ├── Stage 4: ANALYZING
    │   ├── Start LangGraph Orchestrator
    │   │   ├── Plan: decide which agents to run
    │   │   ├── Run Architect Agent (15-25 tool calls)
    │   │   ├── Run Bug Hunter Agent (10-20 tool calls)
    │   │   ├── Run Doc Writer Agent (8-15 tool calls)
    │   │   ├── Run Refactor Agent (10-20 tool calls)
    │   │   ├── Synthesize: combine all results
    │   │   └── Each step emitted via SSE in real-time
    │   ├── Store results in Analysis table
    │   ├── Emit SSE: { stage: "analyzing", progress: 100 }
    │   └── Update DB: status = READY
    │
    └── Cleanup: delete cloned repo from /tmp
```

---

## 2. Tech Stack

### Why Each Choice Was Made

| Layer | Technology | Version | Why This Over Alternatives |
|-------|-----------|---------|---------------------------|
| **Framework** | Next.js | 16.2 | Already scaffolded. App Router + RSC + Server Actions = full-stack in one. React 19 for latest features. |
| **Language** | TypeScript | 5.x | Type safety across the entire stack. Shared types between frontend/backend/agents. |
| **UI Library** | Tailwind CSS | 4.x | Already installed. Utility-first, fast iteration, great DX. |
| **UI Components** | shadcn/ui | latest | Copy-paste components, fully customizable, Radix primitives for accessibility. Not a dependency — actual source files. |
| **State Management** | Zustand | 5.x | Minimal boilerplate, TypeScript-first, works with RSC. Lighter than Redux. |
| **Database** | PostgreSQL | 16 | Relational data (users, repos, analyses). Full-text search (ts_vector). JSON columns for flexible agent output. Battle-tested. |
| **Hosted DB** | Supabase | - | Managed Postgres, built-in connection pooling (PgBouncer), generous free tier, easy migration to self-hosted. |
| **ORM** | Prisma | 6.x | Type-safe queries generated from schema. Migrations. Introspection. Best DX for TypeScript + Postgres. |
| **Vector DB** | Pinecone | - | Purpose-built for embeddings. Serverless tier (no cold starts). Namespace per repo. Metadata filtering. 100k vectors free. |
| **LLM** | OpenAI GPT-4o | - | Best function calling support. Reliable structured output. LangChain integration mature. Cost: $2.50/1M input, $10/1M output. |
| **LLM (simple tasks)** | OpenAI GPT-4o-mini | - | 10x cheaper ($0.15/$0.60 per 1M tokens). Use for summarization, formatting, simple extraction. |
| **Embeddings** | OpenAI text-embedding-3-small | - | 1536 dimensions, $0.02/1M tokens. Best cost/performance for code. |
| **Agent Framework** | LangChain.js + LangGraph | 0.3.x | Stateful multi-agent orchestration. State machines for agent coordination. Tool abstraction. Memory management. |
| **Agent Observability** | LangSmith | - | Traces every LLM call, tool use, chain execution. Token usage, latency, error rates. Free tier available. |
| **Queue** | BullMQ | 5.x | Redis-backed job queue. Priorities, retries, rate limiting, job events. Production-proven. |
| **Cache / Memory** | Redis (Upstash) | - | Serverless Redis. Agent short-term memory. Analysis caching. Rate limit counters. BullMQ backend. |
| **Auth** | NextAuth.js (Auth.js v5) | 5.x | GitHub OAuth built-in. JWT sessions. Database adapter for Prisma. Middleware protection. |
| **Code Parsing** | tree-sitter | - | Language-agnostic AST parsing. Supports 50+ languages. Used by GitHub, Neovim, Zed. |
| **Git Operations** | simple-git | 3.x | Clone, blame, log. Promise-based. Well-maintained. |
| **GitHub API** | Octokit | 4.x | Official GitHub SDK. TypeScript types. Auth integration. |
| **Markdown Rendering** | react-markdown + rehype | - | Render agent responses with code blocks, tables, links. |
| **Syntax Highlighting** | Shiki | 1.x | VS Code's syntax engine. 200+ languages. Server-side rendering support. |
| **Charts** | Recharts | 2.x | React-native charting. Lightweight. Good for language breakdown pie charts, cost dashboards. |
| **Mermaid Diagrams** | mermaid | 11.x | Render architecture diagrams generated by agents. Used in GitHub markdown. |
| **Form Validation** | Zod | 3.x | Runtime + static type validation. Shared between frontend forms and API validation. |
| **Monorepo** | Turborepo | 2.x | Fast builds with caching. Parallel task execution. Simple config. |
| **Package Manager** | pnpm | 9.x | Fast installs, strict dependencies, efficient disk usage. Workspace support. |
| **Error Tracking** | Sentry | - | Frontend + backend. Source maps. Performance monitoring. Free tier: 5k errors/month. |
| **Analytics** | PostHog | - | Product analytics. Feature flags. Session replay. Self-hostable. Free tier: 1M events/month. |
| **Deployment (frontend)** | Vercel | - | Zero-config Next.js deployment. Edge functions. Preview deployments on PR. |
| **Deployment (worker)** | Railway | - | Docker container hosting. Persistent processes for BullMQ workers. $5/month base. |
| **Uptime Monitoring** | BetterStack | - | Uptime checks. Status page. Incident management. Free tier available. |

---

## 3. Project Structure

```
repoinsight/
│
├── app/                                    # Next.js 16 App Router
│   ├── (marketing)/                        # Public pages (no auth required)
│   │   ├── page.tsx                        # Landing page
│   │   ├── pricing/page.tsx                # Pricing page
│   │   └── layout.tsx                      # Marketing layout (no sidebar)
│   │
│   ├── (auth)/                             # Auth pages
│   │   ├── login/page.tsx                  # GitHub OAuth login
│   │   └── layout.tsx                      # Auth layout (centered card)
│   │
│   ├── (dashboard)/                        # Protected pages (auth required)
│   │   ├── dashboard/page.tsx              # Repository list
│   │   ├── repo/[id]/                      # Per-repository views
│   │   │   ├── page.tsx                    # Overview
│   │   │   ├── architecture/page.tsx       # Architecture analysis
│   │   │   ├── bugs/page.tsx               # Bug reports
│   │   │   ├── security/page.tsx           # Security vulnerabilities
│   │   │   ├── refactor/page.tsx           # Refactoring suggestions
│   │   │   ├── docs/page.tsx               # Generated documentation
│   │   │   ├── chat/page.tsx               # Interactive Q&A
│   │   │   ├── agent-logs/page.tsx         # Agent reasoning traces
│   │   │   └── layout.tsx                  # Repo layout (sidebar with tabs)
│   │   ├── settings/
│   │   │   ├── page.tsx                    # Profile settings
│   │   │   └── billing/page.tsx            # Subscription management
│   │   └── layout.tsx                      # Dashboard layout (sidebar + header)
│   │
│   ├── api/                                # Next.js API Route Handlers
│   │   ├── auth/[...nextauth]/route.ts     # NextAuth.js endpoints
│   │   ├── repos/
│   │   │   ├── route.ts                    # POST: submit repo, GET: list repos
│   │   │   └── [id]/
│   │   │       ├── route.ts                # GET: repo details, DELETE: remove repo
│   │   │       ├── analysis/route.ts       # GET: analysis results
│   │   │       ├── chat/route.ts           # POST: chat message (SSE streaming)
│   │   │       ├── progress/route.ts       # GET: SSE stream for ingestion progress
│   │   │       └── agent-logs/route.ts     # GET: agent run traces
│   │   ├── webhooks/
│   │   │   └── stripe/route.ts             # Stripe webhook (future)
│   │   └── health/route.ts                 # Health check
│   │
│   ├── layout.tsx                          # Root layout
│   ├── globals.css                         # Global styles (Tailwind)
│   └── not-found.tsx                       # Custom 404
│
├── components/                             # React components
│   ├── ui/                                 # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   ├── badge.tsx
│   │   ├── tabs.tsx
│   │   ├── table.tsx
│   │   ├── skeleton.tsx
│   │   ├── toast.tsx
│   │   ├── progress.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── sheet.tsx                       # Mobile sidebar
│   │   └── ... (more shadcn components)
│   │
│   ├── layout/                             # Layout components
│   │   ├── sidebar.tsx                     # Main sidebar navigation
│   │   ├── header.tsx                      # Top header bar
│   │   ├── repo-sidebar.tsx                # Per-repo tab navigation
│   │   ├── mobile-nav.tsx                  # Mobile hamburger menu
│   │   └── user-menu.tsx                   # Avatar + dropdown
│   │
│   ├── dashboard/                          # Dashboard page components
│   │   ├── repo-list.tsx                   # Repository card grid
│   │   ├── repo-card.tsx                   # Individual repo card
│   │   ├── repo-input-form.tsx             # URL input + submit
│   │   ├── ingestion-progress.tsx          # Real-time progress display
│   │   └── empty-state.tsx                 # No repos yet CTA
│   │
│   ├── analysis/                           # Analysis view components
│   │   ├── overview-stats.tsx              # Stats cards (files, lines, issues)
│   │   ├── architecture-view.tsx           # Architecture analysis display
│   │   ├── tech-stack-badges.tsx           # Tech stack icons/badges
│   │   ├── module-card.tsx                 # Module breakdown card
│   │   ├── bug-report-table.tsx            # Sortable/filterable bug list
│   │   ├── bug-card.tsx                    # Expandable bug detail card
│   │   ├── security-view.tsx               # Security findings
│   │   ├── refactor-suggestion.tsx         # Refactoring suggestion card
│   │   ├── docs-viewer.tsx                 # Markdown preview + editor
│   │   └── severity-badge.tsx              # Critical/High/Medium/Low badge
│   │
│   ├── chat/                               # Chat UI components
│   │   ├── chat-container.tsx              # Main chat layout
│   │   ├── message-list.tsx                # Scrollable message list
│   │   ├── message-bubble.tsx              # Individual message (user/assistant)
│   │   ├── chat-input.tsx                  # Message input bar
│   │   ├── tool-use-indicator.tsx          # "Reading src/auth.ts..." display
│   │   ├── source-citation.tsx             # Clickable file reference
│   │   ├── suggested-questions.tsx         # Follow-up question chips
│   │   └── conversation-sidebar.tsx        # Past conversation list
│   │
│   ├── agents/                             # Agent observability components
│   │   ├── activity-feed.tsx               # Real-time agent activity
│   │   ├── agent-status-card.tsx           # Per-agent status (running/done/failed)
│   │   ├── reasoning-trace.tsx             # Full step-by-step trace
│   │   ├── step-card.tsx                   # Individual agent step display
│   │   ├── token-usage.tsx                 # Token count + cost display
│   │   └── cost-breakdown.tsx              # Per-agent cost table
│   │
│   ├── shared/                             # Shared/reusable components
│   │   ├── code-viewer.tsx                 # Syntax-highlighted code block
│   │   ├── diff-viewer.tsx                 # Side-by-side diff
│   │   ├── mermaid-renderer.tsx            # Mermaid diagram display
│   │   ├── file-tree.tsx                   # File tree browser
│   │   ├── markdown-renderer.tsx           # Rich markdown display
│   │   ├── loading-skeleton.tsx            # Loading states
│   │   ├── error-boundary.tsx              # Error boundary with retry
│   │   └── confirm-dialog.tsx              # Confirmation modal
│   │
│   └── marketing/                          # Landing page components
│       ├── hero.tsx                         # Hero section
│       ├── features.tsx                     # Feature cards
│       ├── demo-preview.tsx                # Animated demo
│       ├── pricing-table.tsx               # Pricing comparison
│       ├── testimonials.tsx                # Social proof
│       └── footer.tsx                      # Footer
│
├── lib/                                    # Shared utilities and configuration
│   ├── auth.ts                             # NextAuth.js configuration
│   ├── prisma.ts                           # Prisma client singleton
│   ├── redis.ts                            # Redis (Upstash) client
│   ├── pinecone.ts                         # Pinecone client initialization
│   ├── openai.ts                           # OpenAI client initialization
│   ├── bullmq.ts                           # BullMQ queue + worker setup
│   ├── socket.ts                           # SSE helper utilities
│   ├── crypto.ts                           # Token encryption (AES-256-GCM)
│   ├── github.ts                           # Octokit initialization
│   ├── rate-limit.ts                       # Rate limiting utilities
│   ├── logger.ts                           # Structured logging (pino)
│   ├── constants.ts                        # App-wide constants
│   └── utils.ts                            # General utilities (cn, batch, etc.)
│
├── stores/                                 # Zustand state stores
│   ├── repo.store.ts                       # Repository list + selected repo
│   ├── analysis.store.ts                   # Analysis results
│   ├── chat.store.ts                       # Chat messages + conversations
│   └── agent.store.ts                      # Agent activity + traces
│
├── types/                                  # TypeScript type definitions
│   ├── repo.types.ts                       # Repository, RepoStatus
│   ├── analysis.types.ts                   # Analysis, BugReport, ArchitectureAnalysis
│   ├── agent.types.ts                      # AgentRun, AgentStep, AgentType
│   ├── chat.types.ts                       # Conversation, Message, ChatEvent
│   └── api.types.ts                        # API request/response types
│
├── hooks/                                  # Custom React hooks
│   ├── use-sse.ts                          # Server-Sent Events hook
│   ├── use-repo.ts                         # Fetch repo data
│   ├── use-analysis.ts                     # Fetch analysis results
│   ├── use-chat.ts                         # Chat with streaming
│   └── use-agent-logs.ts                   # Fetch agent traces
│
├── workers/                                # Background worker processes
│   ├── index.ts                            # Worker entry point
│   ├── ingestion.worker.ts                 # Repo ingestion pipeline worker
│   └── analysis.worker.ts                  # Agent analysis pipeline worker
│
├── agents/                                 # AI Agent definitions
│   ├── orchestrator.ts                     # LangGraph state machine
│   ├── architect.agent.ts                  # Architecture analysis agent
│   ├── bug-hunter.agent.ts                 # Bug detection agent
│   ├── doc-writer.agent.ts                 # Documentation generation agent
│   ├── refactor.agent.ts                   # Refactoring suggestion agent
│   ├── chat.agent.ts                       # Interactive Q&A agent
│   ├── fix-generator.agent.ts              # Code fix generation agent
│   ├── tools/                              # Agent tool definitions
│   │   ├── file-read.tool.ts               # Read repository files
│   │   ├── vector-search.tool.ts           # Semantic code search
│   │   ├── ast-parse.tool.ts               # Parse code structure
│   │   ├── dep-graph.tool.ts               # Dependency graph traversal
│   │   ├── github-api.tool.ts              # GitHub API queries
│   │   └── git-blame.tool.ts               # Git blame information
│   ├── memory/                             # Agent memory system
│   │   ├── short-term.ts                   # Redis-based session memory
│   │   └── long-term.ts                    # Pinecone-based persistent memory
│   └── tracking/                           # Agent observability
│       └── agent-tracker.ts                # Step tracking + cost calculation
│
├── services/                               # Business logic services
│   ├── clone.service.ts                    # Repository cloning
│   ├── parser.service.ts                   # Code parsing (tree-sitter)
│   ├── chunker.service.ts                  # Smart semantic chunking
│   ├── embedder.service.ts                 # Embedding generation
│   ├── retriever.service.ts                # Hybrid retrieval (vector + keyword + RRF)
│   ├── github-pr.service.ts                # PR creation via Octokit
│   └── cost-tracker.service.ts             # Token usage + cost tracking
│
├── prompts/                                # Versioned prompt templates
│   ├── orchestrator.prompt.md              # Orchestrator system prompt
│   ├── architect.prompt.md                 # Architect agent prompt
│   ├── bug-hunter.prompt.md                # Bug Hunter agent prompt
│   ├── doc-writer.prompt.md                # Doc Writer agent prompt
│   ├── refactor.prompt.md                  # Refactor agent prompt
│   ├── chat.prompt.md                      # Chat agent prompt
│   └── fix-generator.prompt.md             # Fix generator prompt
│
├── prisma/                                 # Prisma ORM
│   ├── schema.prisma                       # Database schema
│   ├── migrations/                         # Migration files
│   └── seed.ts                             # Seed script
│
├── docker-compose.yml                      # Local Postgres + Redis
├── turbo.json                              # Turborepo config (if workspace needed)
├── package.json                            # Dependencies
├── tsconfig.json                           # TypeScript config
├── next.config.ts                          # Next.js config
├── postcss.config.mjs                      # PostCSS (Tailwind)
├── eslint.config.mjs                       # ESLint config
├── .env.example                            # Environment variable template
├── .env.local                              # Local environment (gitignored)
├── .gitignore
├── CLAUDE.md                               # Claude Code instructions
├── AGENTS.md                               # Next.js 16 agent notes
│
└── docs/                                   # Documentation
    ├── PRD.md                              # Product Requirements Document
    └── IMPLEMENTATION-PLAN.md              # This file
```

---

## 4. Database Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────

model User {
  id            String         @id @default(cuid())
  email         String         @unique
  name          String?
  githubId      String         @unique
  githubToken   String         // Encrypted with AES-256-GCM
  image         String?        // GitHub avatar URL
  plan          Plan           @default(FREE)
  repositories  Repository[]
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
}

enum Plan {
  FREE
  PRO
  TEAM
}

// ─────────────────────────────────────────────────────
// REPOSITORIES
// ─────────────────────────────────────────────────────

model Repository {
  id              String         @id @default(cuid())
  userId          String
  user            User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  githubUrl       String
  owner           String         // GitHub org/user
  name            String         // Repo name
  defaultBranch   String         @default("main")
  status          RepoStatus     @default(PENDING)
  language        String?        // Primary language detected
  techStack       Json?          // { languages: [], frameworks: [], databases: [], tools: [] }
  fileCount       Int?
  totalLines      Int?
  repoSizeBytes   Int?           // Size of cloned repo
  analyses        Analysis[]
  agentRuns       AgentRun[]
  conversations   Conversation[]
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@unique([userId, githubUrl])  // Prevent duplicate repos per user
  @@index([userId])
  @@index([status])
}

enum RepoStatus {
  PENDING
  CLONING
  PARSING
  EMBEDDING
  ANALYZING
  READY
  FAILED
}

// ─────────────────────────────────────────────────────
// AGENT RUNS — Tracks each agent execution
// ─────────────────────────────────────────────────────

model AgentRun {
  id           String      @id @default(cuid())
  repoId       String
  repository   Repository  @relation(fields: [repoId], references: [id], onDelete: Cascade)
  agentType    AgentType
  status       AgentStatus @default(QUEUED)
  steps        AgentStep[]
  result       Json?       // Final structured output from the agent
  error        String?     // Error message if failed
  tokenUsage   Json?       // { promptTokens, completionTokens, totalCost, model }
  startedAt    DateTime?
  completedAt  DateTime?
  createdAt    DateTime    @default(now())

  @@index([repoId])
  @@index([repoId, agentType])
}

enum AgentType {
  ORCHESTRATOR
  ARCHITECT
  BUG_HUNTER
  DOC_WRITER
  REFACTOR
  CHAT
  FIX_GENERATOR
}

enum AgentStatus {
  QUEUED
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}

// ─────────────────────────────────────────────────────
// AGENT STEPS — Every thought, tool call, and result
// ─────────────────────────────────────────────────────

model AgentStep {
  id          String   @id @default(cuid())
  agentRunId  String
  agentRun    AgentRun @relation(fields: [agentRunId], references: [id], onDelete: Cascade)
  stepNumber  Int
  type        String   // "thought" | "tool_call" | "tool_result" | "response"
  content     Json     // Step-specific data:
                       //   thought: { text: "I should check the auth middleware..." }
                       //   tool_call: { tool: "read_file", args: { filePath: "src/auth.ts" } }
                       //   tool_result: { tool: "read_file", result: "...", truncated: true }
                       //   response: { text: "The architecture is..." }
  tokenCount  Int?     // Tokens used in this step
  duration    Int?     // Milliseconds taken
  createdAt   DateTime @default(now())

  @@index([agentRunId])
  @@index([agentRunId, stepNumber])
}

// ─────────────────────────────────────────────────────
// ANALYSIS RESULTS — Structured output from agents
// ─────────────────────────────────────────────────────

model Analysis {
  id          String       @id @default(cuid())
  repoId      String
  repository  Repository   @relation(fields: [repoId], references: [id], onDelete: Cascade)
  agentRunId  String?      // Link to the agent run that produced this
  type        AnalysisType
  result      Json         // Type-specific structured result:
                           //   ARCHITECTURE: { projectPurpose, techStack, modules[], dataFlow, entryPoints[] }
                           //   BUGS: { issues: [{ severity, category, title, file, ... }] }
                           //   SECURITY: { vulnerabilities: [{ severity, owasp, ... }] }
                           //   REFACTORING: { suggestions: [{ priority, category, ... }] }
                           //   DOCUMENTATION: { readme, apiDocs, architectureGuide }
                           //   TECH_DEBT: { score, items: [...] }
  version     Int          @default(1) // Increments on re-analysis
  createdAt   DateTime     @default(now())

  @@index([repoId, type])
  @@index([repoId, type, version])
}

enum AnalysisType {
  ARCHITECTURE
  BUGS
  SECURITY
  REFACTORING
  DOCUMENTATION
  TECH_DEBT
}

// ─────────────────────────────────────────────────────
// CONVERSATIONS — Chat history
// ─────────────────────────────────────────────────────

model Conversation {
  id         String    @id @default(cuid())
  repoId     String
  repository Repository @relation(fields: [repoId], references: [id], onDelete: Cascade)
  title      String?    // Auto-generated from first message or user-set
  messages   Message[]
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt

  @@index([repoId])
}

model Message {
  id              String       @id @default(cuid())
  conversationId  String
  conversation    Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  role            String       // "user" | "assistant"
  content         String       @db.Text
  toolCalls       Json?        // [{ tool: "read_file", args: {...}, result: "..." }]
  sources         Json?        // [{ filePath: "src/auth.ts", lineStart: 15, lineEnd: 42 }]
  tokenCount      Int?
  createdAt       DateTime     @default(now())

  @@index([conversationId])
  @@index([conversationId, createdAt])
}

// ─────────────────────────────────────────────────────
// FILE INDEX — Parsed files for keyword search
// ─────────────────────────────────────────────────────

model FileIndex {
  id          String   @id @default(cuid())
  repoId      String
  filePath    String
  language    String
  content     String   @db.Text
  lineCount   Int
  functions   Json?    // [{ name, params, lineStart, lineEnd }]
  classes     Json?    // [{ name, methods, lineStart, lineEnd }]
  imports     Json?    // ["module1", "module2"]
  exports     Json?    // ["func1", "Class1"]
  searchVector Unsupported("tsvector")? // PostgreSQL full-text search vector
  createdAt   DateTime @default(now())

  @@index([repoId])
  @@index([repoId, filePath])
  // Full-text search index would be added via raw SQL migration:
  // CREATE INDEX file_index_search_idx ON "FileIndex" USING gin("searchVector");
}
```

### Entity Relationship Diagram

```
User (1) ──────── (N) Repository
                       │
            ┌──────────┼──────────┬──────────┐
            │          │          │          │
        (N) AgentRun  (N) Analysis (N) Conversation (N) FileIndex
            │                         │
        (N) AgentStep            (N) Message
```

---

## 5. API Design

### Authentication

All `/api/repos/*` endpoints require authentication via NextAuth.js session.

### Endpoints

#### Repository Management

```
POST   /api/repos
  Body: { githubUrl: string }
  Response: { id: string, status: "PENDING" }
  Action: Validate URL, create repo record, enqueue ingestion job

GET    /api/repos
  Response: { repos: Repository[] }
  Action: List user's repositories with status

GET    /api/repos/[id]
  Response: { repo: Repository & { analyses: Analysis[] } }
  Action: Get repo details with latest analysis results

DELETE /api/repos/[id]
  Response: { success: true }
  Action: Delete repo, analyses, agent runs, conversations, vectors from Pinecone
```

#### Analysis Results

```
GET    /api/repos/[id]/analysis
  Query: { type?: AnalysisType }
  Response: { analyses: Analysis[] }
  Action: Get analysis results, optionally filtered by type

GET    /api/repos/[id]/analysis/bugs
  Query: { severity?: string, category?: string, sortBy?: string }
  Response: { bugs: BugReport[], total: number }
  Action: Get bug reports with filtering and sorting

GET    /api/repos/[id]/analysis/architecture
  Response: { architecture: ArchitectureAnalysis }
  Action: Get architecture analysis result
```

#### Chat

```
POST   /api/repos/[id]/chat
  Body: { message: string, conversationId?: string }
  Response: SSE stream
    → { type: "tool_use", tool: "read_file", input: { filePath: "..." } }
    → { type: "tool_result", summary: "Read 45 lines from src/auth.ts" }
    → { type: "token", content: "The authentication..." }
    → { type: "sources", files: [{ path: "src/auth.ts", lines: [15, 42] }] }
    → { type: "suggestions", questions: ["How does...", "Where is...", "Why does..."] }
    → { type: "done", conversationId: "clx...", tokenCount: 1523 }
  Action: Run chat agent with streaming, save to conversation

GET    /api/repos/[id]/conversations
  Response: { conversations: Conversation[] }
  Action: List conversations for a repo

GET    /api/repos/[id]/conversations/[convId]
  Response: { conversation: Conversation & { messages: Message[] } }
  Action: Get conversation with full message history
```

#### Ingestion Progress (SSE)

```
GET    /api/repos/[id]/progress
  Response: SSE stream
    → { stage: "cloning", progress: 25 }
    → { stage: "parsing", progress: 50, fileCount: 342, languages: {...} }
    → { stage: "embedding", progress: 75, chunkCount: 1205 }
    → { stage: "analyzing", progress: 80, agent: "architect", status: "running" }
    → { stage: "analyzing", progress: 85, agent: "architect", step: { type: "tool_call", ... } }
    → { stage: "analyzing", progress: 90, agent: "bug_hunter", status: "running" }
    → { stage: "complete", progress: 100 }
  Action: Stream ingestion + analysis progress events
```

#### Agent Logs

```
GET    /api/repos/[id]/agent-logs
  Response: { runs: AgentRun[] }
  Action: List all agent runs for a repo

GET    /api/repos/[id]/agent-logs/[runId]
  Response: { run: AgentRun & { steps: AgentStep[] } }
  Action: Get full agent run with all steps
```

---

## 6. Agent System Architecture

### Agent Orchestrator (LangGraph State Machine)

```
                    ┌─────────┐
                    │  START   │
                    └────┬────┘
                         │
                    ┌────▼────┐
                    │  PLAN   │  LLM decides which agents to run
                    └────┬────┘  based on repo characteristics
                         │
                    ┌────▼────────────┐
                    │  ROUTE          │  Pick next pending agent
                    │  (conditional)  │  from the plan
                    └──┬──┬──┬──┬────┘
                       │  │  │  │
          ┌────────────┘  │  │  └────────────┐
          │            │  │            │
    ┌─────▼────┐ ┌─────▼────┐ ┌──────▼───┐ ┌─────▼────┐
    │ARCHITECT │ │BUG_HUNTER│ │DOC_WRITER│ │REFACTOR  │
    │  Agent   │ │  Agent   │ │  Agent   │ │  Agent   │
    └─────┬────┘ └─────┬────┘ └──────┬───┘ └─────┬────┘
          │            │            │            │
          └────────────┴─────┬──────┴────────────┘
                             │
                    ┌────────▼────┐
                    │  ROUTE      │  Any more pending agents?
                    │  (back)     │──── Yes → next agent
                    └──────┬─────┘
                           │ No
                    ┌──────▼─────┐
                    │ SYNTHESIZE │  Combine all agent results
                    └──────┬─────┘  into final summary
                           │
                    ┌──────▼─────┐
                    │    END     │
                    └────────────┘
```

### Shared State Schema

```typescript
interface OrchestratorState {
  // Input
  repoId: string;
  repoContext: {
    name: string;
    owner: string;
    primaryLanguage: string;
    techStack: TechStack;
    fileCount: number;
    totalLines: number;
    hasTests: boolean;
    hasCICD: boolean;
    hasDocker: boolean;
    topLevelFiles: string[];
    topLevelDirs: string[];
  };

  // Plan
  plan: {
    tasks: {
      agent: 'architect' | 'bug_hunter' | 'doc_writer' | 'refactor';
      priority: number;
      reason: string;
      status: 'pending' | 'running' | 'done' | 'failed';
    }[];
  };

  // Agent Results (populated as agents complete)
  architectureResult?: ArchitectureAnalysis;
  bugResults?: BugReport[];
  securityResults?: SecurityIssue[];
  docResult?: DocumentationOutput;
  refactorResults?: RefactorSuggestion[];

  // Synthesis
  finalSummary?: string;

  // Tracking
  currentAgent: string;
  errors: string[];
}
```

### Agent Tool Registry

All agents share these tools (LangChain DynamicStructuredTool with Zod schemas):

| Tool | Name | Input Schema | What It Does |
|------|------|-------------|-------------|
| File Read | `read_file` | `{ filePath: string, startLine?: number, endLine?: number }` | Read file contents from the cloned repo |
| Vector Search | `semantic_code_search` | `{ query: string, topK?: number }` | Semantic search over codebase via Pinecone |
| AST Parse | `parse_code_structure` | `{ filePath: string }` | Extract functions, classes, imports, exports |
| Dependency Graph | `get_dependency_graph` | `{ filePath?: string, depth?: number }` | Get import/dependency graph |
| GitHub API | `github_api` | `{ endpoint: enum, params?: object }` | Query GitHub (issues, PRs, contributors, commits, languages) |
| Git Blame | `git_blame` | `{ filePath: string, startLine?: number, endLine?: number }` | Who wrote what and when |

### Agent Memory System

```
┌─────────────────────────────────────────────────┐
│              SHORT-TERM MEMORY (Redis)            │
│                                                   │
│  Key: repo:{repoId}:memory                        │
│  Type: Hash                                       │
│  TTL: 1 hour                                      │
│                                                   │
│  Fields:                                          │
│    architect:techStack → {...}                     │
│    architect:modules → [...]                       │
│    architect:entryPoints → [...]                   │
│    bug_hunter:highRiskAreas → [...]                │
│    bug_hunter:findings → [...]                     │
│                                                   │
│  Purpose: Agents share findings during a single   │
│           analysis run. Bug Hunter reads           │
│           Architect's findings to know where       │
│           to focus.                                │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│              LONG-TERM MEMORY (Pinecone)          │
│                                                   │
│  Namespace: {repoId}:insights                     │
│                                                   │
│  Stored as embeddings:                            │
│    "This project uses JWT auth with refresh       │
│     tokens stored in httpOnly cookies"            │
│    "The payment module has a race condition        │
│     in concurrent checkout flows"                 │
│                                                   │
│  Purpose: Persist key insights for future          │
│           chat conversations. When a user asks     │
│           about auth 2 weeks later, the chat       │
│           agent retrieves these insights.          │
└─────────────────────────────────────────────────┘
```

---

## Phase 1 — Foundation & Auth (Week 1-2)

### Goal
Project scaffolding, database setup, GitHub OAuth, basic dashboard UI shell, Docker local dev environment.

### Tasks

#### 1.1 Development Environment

- [ ] Set up Docker Compose for local PostgreSQL 16 + Redis 7
- [ ] Create `.env.example` with all required variables
- [ ] Create `.env.local` from example (gitignored)
- [ ] Configure TypeScript strict mode
- [ ] Configure ESLint + Prettier
- [ ] Set up path aliases (`@/` → project root)

**docker-compose.yml:**
```yaml
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: repoinsight
      POSTGRES_PASSWORD: repoinsight_dev
      POSTGRES_DB: repoinsight
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

#### 1.2 Install Dependencies

```bash
# UI components
pnpm add @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-dropdown-menu \
  @radix-ui/react-tabs @radix-ui/react-tooltip @radix-ui/react-progress \
  @radix-ui/react-sheet @radix-ui/react-badge \
  class-variance-authority clsx tailwind-merge lucide-react

# Database
pnpm add prisma @prisma/client

# Auth
pnpm add next-auth@5

# State
pnpm add zustand

# Utilities
pnpm add zod

# Dev
pnpm add -D prisma @types/node tsx
```

#### 1.3 Database Setup

- [ ] Initialize Prisma: `npx prisma init`
- [ ] Write complete schema (as defined in Section 4)
- [ ] Run initial migration: `npx prisma migrate dev --name init`
- [ ] Add full-text search index via raw SQL migration
- [ ] Create seed script with test user + sample repo data
- [ ] Verify all relations and indexes

**Raw SQL migration for full-text search:**
```sql
-- Add tsvector column and index for FileIndex
ALTER TABLE "FileIndex" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;
CREATE INDEX file_index_search_idx ON "FileIndex" USING gin("searchVector");
```

#### 1.4 Authentication

- [ ] Configure NextAuth.js v5 with GitHub OAuth provider
- [ ] Implement Prisma adapter for session/user storage
- [ ] Store GitHub access token encrypted (AES-256-GCM) on user record
- [ ] Create auth middleware for API routes
- [ ] Create `useSession` hook wrapper
- [ ] Build login page with GitHub button
- [ ] Build logout functionality
- [ ] Protected route wrapper component

**lib/auth.ts (core):**
```typescript
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: { params: { scope: "read:user user:email repo" } },
    }),
  ],
  callbacks: {
    async signIn({ account }) {
      if (account?.access_token) {
        // Encrypt and store GitHub token for repo access
        await prisma.user.update({
          where: { githubId: account.providerAccountId },
          data: { githubToken: encrypt(account.access_token) },
        });
      }
      return true;
    },
    async session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
```

**lib/crypto.ts:**
```typescript
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, "hex"); // 32 bytes

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
```

#### 1.5 Frontend Shell

- [ ] Install and configure shadcn/ui (init + core components)
- [ ] Build root layout with font configuration (Geist)
- [ ] Build marketing layout (no sidebar)
- [ ] Build dashboard layout (sidebar + header + main content)
- [ ] Build repo layout (sidebar with analysis tabs)
- [ ] Create all page stubs with empty states
- [ ] Build sidebar component with navigation
- [ ] Build header with user menu
- [ ] Dark mode support (system preference + toggle)
- [ ] Responsive design (mobile sidebar as sheet)

#### 1.6 Landing Page

- [ ] Hero section: "Understand any GitHub repo in minutes"
- [ ] Feature cards: Architecture, Bugs, Docs, Chat
- [ ] How it works (3 steps: Paste URL → AI Analyzes → Get Insights)
- [ ] CTA: "Get Started with GitHub"

### Deliverables
- Local dev environment running (`docker compose up` + `pnpm dev`)
- GitHub OAuth login working end-to-end
- Dashboard page rendering (empty state)
- Database migrated with all tables
- Landing page live
- All page routes stubbed

### Key Files
```
docker-compose.yml
prisma/schema.prisma
lib/auth.ts
lib/prisma.ts
lib/crypto.ts
app/(auth)/login/page.tsx
app/(dashboard)/layout.tsx
app/(dashboard)/dashboard/page.tsx
components/layout/sidebar.tsx
components/layout/header.tsx
components/dashboard/empty-state.tsx
```

---

## Phase 2 — Repository Ingestion Pipeline (Week 3-4)

### Goal
Clone repos, parse code with tree-sitter, smart semantic chunking, generate embeddings, store in Pinecone, real-time progress via SSE.

### Tasks

#### 2.1 Install Agent/Pipeline Dependencies

```bash
# AI / LLM
pnpm add openai @langchain/openai @langchain/core @langchain/langgraph langchain

# Vector DB
pnpm add @pinecone-database/pinecone

# Queue
pnpm add bullmq ioredis

# Git + Parsing
pnpm add simple-git
pnpm add tree-sitter tree-sitter-javascript tree-sitter-typescript \
  tree-sitter-python tree-sitter-go tree-sitter-java tree-sitter-rust

# GitHub API
pnpm add @octokit/rest
```

#### 2.2 Repository Cloning Service

- [ ] Accept GitHub URL, validate format with Zod
- [ ] Check repo accessibility using user's decrypted GitHub token
- [ ] Shallow clone (`--depth 1`) to `/tmp/repos/{repoId}`
- [ ] Detect default branch
- [ ] Handle errors: private repo without access, repo not found, network timeout
- [ ] Emit progress events

**services/clone.service.ts:**
```typescript
import simpleGit from "simple-git";
import { existsSync, mkdirSync } from "fs";
import { Octokit } from "@octokit/rest";
import { decrypt } from "@/lib/crypto";

const CLONE_BASE = "/tmp/repoinsight-repos";

export async function cloneRepository(
  githubUrl: string,
  repoId: string,
  encryptedToken: string
): Promise<{ path: string; branch: string }> {
  const token = decrypt(encryptedToken);
  const clonePath = `${CLONE_BASE}/${repoId}`;

  // Ensure base directory exists
  if (!existsSync(CLONE_BASE)) mkdirSync(CLONE_BASE, { recursive: true });

  // Build authenticated clone URL
  const url = new URL(githubUrl);
  const authenticatedUrl = `https://x-access-token:${token}@${url.host}${url.pathname}.git`;

  // Detect default branch
  const octokit = new Octokit({ auth: token });
  const [owner, name] = url.pathname.replace(/^\//, "").replace(/\.git$/, "").split("/");
  const { data: repo } = await octokit.repos.get({ owner, repo: name });
  const defaultBranch = repo.default_branch;

  // Shallow clone
  await simpleGit().clone(authenticatedUrl, clonePath, [
    "--depth", "1",
    "--branch", defaultBranch,
    "--single-branch",
  ]);

  return { path: clonePath, branch: defaultBranch };
}

export async function cleanupClone(repoId: string): Promise<void> {
  const clonePath = `${CLONE_BASE}/${repoId}`;
  await fs.rm(clonePath, { recursive: true, force: true });
}
```

#### 2.3 Code Parsing Engine

- [ ] Walk directory tree recursively
- [ ] Skip: `node_modules`, `.git`, `vendor`, `dist`, `build`, `__pycache__`, binary files, images, lock files
- [ ] Detect language per file (extension mapping + tree-sitter grammar matching)
- [ ] Extract AST per file: functions (name, params, line range, code), classes (name, methods, line range, code), imports, exports
- [ ] Build inter-file dependency graph (import/require resolution)
- [ ] Detect tech stack from: `package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`, `pom.xml`, `build.gradle`, `Gemfile`, `composer.json`, Dockerfiles, CI configs
- [ ] Calculate stats: file count, total lines, language breakdown

**services/parser.service.ts (interface):**
```typescript
export interface ParsedFile {
  path: string;           // Relative path from repo root
  language: string;       // "typescript" | "python" | "go" | etc.
  content: string;        // Full file content
  functions: {
    name: string;
    params: string[];
    lineStart: number;
    lineEnd: number;
    code: string;         // Function body including signature
  }[];
  classes: {
    name: string;
    methods: { name: string; lineStart: number; lineEnd: number }[];
    lineStart: number;
    lineEnd: number;
    code: string;
  }[];
  imports: string[];      // Module names imported
  exports: string[];      // Exported identifiers
  lineCount: number;
}

export interface DependencyGraph {
  nodes: { id: string; label: string; language: string }[];
  edges: { source: string; target: string; type: "import" | "require" }[];
}

export interface TechStack {
  languages: { name: string; percentage: number; fileCount: number }[];
  frameworks: string[];
  databases: string[];
  tools: string[];        // Docker, CI/CD, linters, etc.
  packageManager: string; // npm, pnpm, yarn, pip, cargo, etc.
}

// Skip patterns
const SKIP_DIRS = new Set([
  "node_modules", ".git", "vendor", "dist", "build", ".next",
  "__pycache__", ".venv", "venv", ".idea", ".vscode", "coverage",
  ".turbo", ".cache", "target", "bin", "obj",
]);

const SKIP_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp",
  ".woff", ".woff2", ".ttf", ".eot",
  ".zip", ".tar", ".gz", ".rar",
  ".mp3", ".mp4", ".avi", ".mov",
  ".pdf", ".doc", ".docx",
  ".lock", ".sum",
  ".min.js", ".min.css",
  ".map",
]);

const MAX_FILE_SIZE = 100_000; // 100KB — skip very large files
```

#### 2.4 Smart Semantic Chunking

- [ ] Chunk by semantic boundaries (NOT naive 512-token splits)
- [ ] Each function/method = one chunk
- [ ] Each class = summary chunk + individual method chunks
- [ ] Import section = one chunk per file
- [ ] Config files (package.json, tsconfig, etc.) = one chunk each
- [ ] Large files without clear structure = overlapping window chunks (512 tokens, 50 overlap)
- [ ] Prefix each chunk with context: `// File: path/to/file.ts\n// Function: functionName\n`
- [ ] Rich metadata per chunk

**services/chunker.service.ts:**
```typescript
export interface CodeChunk {
  id: string;              // Unique ID: "{repoId}:{filePath}:{type}:{name}"
  content: string;         // Chunk text with context prefix
  metadata: {
    filePath: string;
    language: string;
    type: "file_summary" | "function" | "class" | "imports" | "config" | "chunk";
    name?: string;         // Function/class name
    lineStart?: number;
    lineEnd?: number;
    imports?: string[];    // For file_summary chunks
    exports?: string[];    // For file_summary chunks
  };
}

export class SemanticChunker {
  chunkFile(repoId: string, file: ParsedFile): CodeChunk[] {
    const chunks: CodeChunk[] = [];

    // 1. File summary chunk (always)
    chunks.push({
      id: `${repoId}:${file.path}:summary`,
      content: [
        `// File: ${file.path}`,
        `// Language: ${file.language}`,
        `// Lines: ${file.lineCount}`,
        `// Imports: ${file.imports.join(", ") || "none"}`,
        `// Exports: ${file.exports.join(", ") || "none"}`,
        `// Functions: ${file.functions.map(f => f.name).join(", ") || "none"}`,
        `// Classes: ${file.classes.map(c => c.name).join(", ") || "none"}`,
      ].join("\n"),
      metadata: {
        filePath: file.path,
        language: file.language,
        type: "file_summary",
        imports: file.imports,
        exports: file.exports,
      },
    });

    // 2. Function chunks
    for (const fn of file.functions) {
      chunks.push({
        id: `${repoId}:${file.path}:fn:${fn.name}`,
        content: `// File: ${file.path}\n// Function: ${fn.name}(${fn.params.join(", ")})\n${fn.code}`,
        metadata: {
          filePath: file.path,
          language: file.language,
          type: "function",
          name: fn.name,
          lineStart: fn.lineStart,
          lineEnd: fn.lineEnd,
        },
      });
    }

    // 3. Class chunks
    for (const cls of file.classes) {
      chunks.push({
        id: `${repoId}:${file.path}:class:${cls.name}`,
        content: `// File: ${file.path}\n// Class: ${cls.name}\n// Methods: ${cls.methods.map(m => m.name).join(", ")}\n${cls.code}`,
        metadata: {
          filePath: file.path,
          language: file.language,
          type: "class",
          name: cls.name,
          lineStart: cls.lineStart,
          lineEnd: cls.lineEnd,
        },
      });
    }

    return chunks;
  }
}
```

#### 2.5 Embedding Pipeline

- [ ] Batch embed chunks via OpenAI `text-embedding-3-small` (batches of 100)
- [ ] Upsert to Pinecone with namespace per repo
- [ ] Store metadata: repoId, filePath, language, type, name, contentPreview (first 500 chars)
- [ ] Handle rate limits with exponential backoff
- [ ] Track embedding costs (tokens used)

**services/embedder.service.ts:**
```typescript
import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";

const openai = new OpenAI();
const pinecone = new Pinecone();
const index = pinecone.index(process.env.PINECONE_INDEX!);

export async function embedAndStore(
  repoId: string,
  chunks: CodeChunk[]
): Promise<{ totalTokens: number; vectorCount: number }> {
  let totalTokens = 0;
  const BATCH_SIZE = 100;
  const batches = batchArray(chunks, BATCH_SIZE);

  for (const batch of batches) {
    // Generate embeddings
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: batch.map((c) => c.content),
      dimensions: 1536,
    });

    totalTokens += response.usage.total_tokens;

    // Prepare vectors for Pinecone
    const vectors = response.data.map((embedding, i) => ({
      id: batch[i].id,
      values: embedding.embedding,
      metadata: {
        ...batch[i].metadata,
        repoId,
        contentPreview: batch[i].content.slice(0, 500),
      },
    }));

    // Upsert to Pinecone (namespace = repoId)
    await index.namespace(repoId).upsert(vectors);
  }

  return { totalTokens, vectorCount: chunks.length };
}

function batchArray<T>(arr: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    batches.push(arr.slice(i, i + size));
  }
  return batches;
}
```

#### 2.6 Hybrid Retriever

- [ ] **Semantic search**: Embed query → search Pinecone → filter by repoId namespace
- [ ] **Keyword search**: PostgreSQL full-text search on FileIndex table
- [ ] **Reciprocal Rank Fusion (RRF)**: Merge both result sets (k=60)
- [ ] Return top-K results with metadata and content previews

**services/retriever.service.ts:**
```typescript
export class HybridRetriever {
  async retrieve(
    repoId: string,
    query: string,
    topK: number = 10
  ): Promise<RetrievalResult[]> {
    // Run semantic + keyword search in parallel
    const [semanticResults, keywordResults] = await Promise.all([
      this.semanticSearch(repoId, query, topK * 2),
      this.keywordSearch(repoId, query, topK * 2),
    ]);

    // Merge with Reciprocal Rank Fusion
    const fused = this.reciprocalRankFusion(semanticResults, keywordResults);

    return fused.slice(0, topK);
  }

  private async semanticSearch(
    repoId: string,
    query: string,
    topK: number
  ): Promise<RetrievalResult[]> {
    // Embed the query
    const queryEmbedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
      dimensions: 1536,
    });

    // Search Pinecone
    const results = await index.namespace(repoId).query({
      vector: queryEmbedding.data[0].embedding,
      topK,
      includeMetadata: true,
    });

    return results.matches.map((match) => ({
      id: match.id,
      score: match.score || 0,
      filePath: match.metadata?.filePath as string,
      content: match.metadata?.contentPreview as string,
      type: match.metadata?.type as string,
      name: match.metadata?.name as string,
    }));
  }

  private async keywordSearch(
    repoId: string,
    query: string,
    topK: number
  ): Promise<RetrievalResult[]> {
    const results = await prisma.$queryRaw`
      SELECT id, "filePath", content, language,
             ts_rank("searchVector", plainto_tsquery('english', ${query})) as rank
      FROM "FileIndex"
      WHERE "repoId" = ${repoId}
        AND "searchVector" @@ plainto_tsquery('english', ${query})
      ORDER BY rank DESC
      LIMIT ${topK}
    `;

    return results.map((r: any) => ({
      id: r.id,
      score: r.rank,
      filePath: r.filePath,
      content: r.content.slice(0, 500),
      type: "file",
    }));
  }

  private reciprocalRankFusion(
    ...resultSets: RetrievalResult[][]
  ): RetrievalResult[] {
    const k = 60; // RRF constant
    const scores = new Map<string, { score: number; result: RetrievalResult }>();

    for (const results of resultSets) {
      results.forEach((result, rank) => {
        const existing = scores.get(result.id);
        const rrfScore = 1 / (k + rank + 1);
        if (existing) {
          existing.score += rrfScore;
        } else {
          scores.set(result.id, { score: rrfScore, result });
        }
      });
    }

    return [...scores.values()]
      .sort((a, b) => b.score - a.score)
      .map(({ result }) => result);
  }
}
```

#### 2.7 Ingestion Pipeline Orchestration

- [ ] BullMQ job processor that runs the full pipeline
- [ ] Stage-by-stage progress emission via Redis pub/sub
- [ ] SSE endpoint that subscribes to progress events
- [ ] Error handling: if any stage fails, mark repo as FAILED with error message
- [ ] Cleanup: delete cloned repo after embedding (keep FileIndex in DB)

**workers/ingestion.worker.ts:**
```typescript
import { Worker, Job } from "bullmq";

const worker = new Worker("ingestion", async (job: Job) => {
  const { repoId, githubUrl, encryptedToken } = job.data;

  try {
    // Stage 1: Clone
    await emitProgress(repoId, { stage: "cloning", progress: 10 });
    await updateRepoStatus(repoId, "CLONING");
    const { path: repoPath, branch } = await cloneRepository(githubUrl, repoId, encryptedToken);
    await emitProgress(repoId, { stage: "cloning", progress: 25 });

    // Stage 2: Parse
    await emitProgress(repoId, { stage: "parsing", progress: 30 });
    await updateRepoStatus(repoId, "PARSING");
    const { files, depGraph, techStack, stats } = await parseRepository(repoPath);
    await storeFileIndex(repoId, files);
    await updateRepoMetadata(repoId, { techStack, ...stats });
    await emitProgress(repoId, { stage: "parsing", progress: 50, fileCount: stats.fileCount });

    // Stage 3: Embed
    await emitProgress(repoId, { stage: "embedding", progress: 55 });
    await updateRepoStatus(repoId, "EMBEDDING");
    const chunks = chunkAllFiles(repoId, files);
    const { totalTokens, vectorCount } = await embedAndStore(repoId, chunks);
    await emitProgress(repoId, { stage: "embedding", progress: 75, chunkCount: vectorCount });

    // Stage 4: Trigger analysis
    await updateRepoStatus(repoId, "ANALYZING");
    await emitProgress(repoId, { stage: "analyzing", progress: 80 });
    await enqueueAnalysis(repoId);

    // Cleanup cloned repo
    await cleanupClone(repoId);
  } catch (error) {
    await updateRepoStatus(repoId, "FAILED");
    await emitProgress(repoId, { stage: "failed", error: error.message });
    await cleanupClone(repoId);
    throw error;
  }
}, { connection: redisConnection });
```

#### 2.8 SSE Progress Endpoint

**app/api/repos/[id]/progress/route.ts:**
```typescript
import { NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const repoId = params.id;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Subscribe to Redis pub/sub for this repo's progress
      const subscriber = createRedisSubscriber();
      subscriber.subscribe(`repo:${repoId}:progress`);

      subscriber.on("message", (channel, message) => {
        controller.enqueue(encoder.encode(`data: ${message}\n\n`));

        const event = JSON.parse(message);
        if (event.stage === "complete" || event.stage === "failed") {
          controller.close();
          subscriber.disconnect();
        }
      });

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 15000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        subscriber.disconnect();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

#### 2.9 Frontend — Repo Input & Progress

- [ ] GitHub URL input form on dashboard (with Zod validation)
- [ ] Submit triggers Server Action → enqueue job → return repoId
- [ ] Real-time progress bar using `useSSE` hook
- [ ] Show stages: Cloning → Parsing → Embedding → Analyzing
- [ ] File count, language breakdown during parsing stage
- [ ] Repository card on dashboard with status badge
- [ ] Error state with retry button

### Deliverables
- End-to-end: paste GitHub URL → repo cloned → code parsed → embeddings in Pinecone
- Smart semantic chunking producing function/class/file-level chunks
- Hybrid retriever (vector + keyword + RRF) working
- Real-time progress displayed on frontend via SSE
- Repository list on dashboard with status indicators

### Key Files
```
docker-compose.yml (updated with tmpfs for /tmp)
services/clone.service.ts
services/parser.service.ts
services/chunker.service.ts
services/embedder.service.ts
services/retriever.service.ts
workers/index.ts
workers/ingestion.worker.ts
lib/redis.ts
lib/pinecone.ts
lib/openai.ts
lib/bullmq.ts
app/api/repos/route.ts
app/api/repos/[id]/progress/route.ts
components/dashboard/repo-input-form.tsx
components/dashboard/ingestion-progress.tsx
hooks/use-sse.ts
```

---

## Phase 3 — Agentic AI Core (Week 5-8)

### Goal
Build the multi-agent system with LangGraph orchestration, ReAct reasoning, shared tools, agent memory, and step tracking. **This is the resume centerpiece.**

### Strategy (Week by Week)

| Week | Focus | What Gets Built |
|------|-------|----------------|
| **5** | Agent tools + basic RAG chains | 6 tools with Zod schemas. Simple non-agentic analysis chains to validate prompts. |
| **6** | LangGraph orchestrator + ReAct agents | Wrap chains in tool-using agents. Build state machine. |
| **7** | Agent memory + inter-agent communication | Redis short-term memory. Agents read each other's findings. |
| **8** | Step tracking, error recovery, polish | DB persistence for every step. SSE real-time. Error handling. |

### Tasks

#### 3.1 Agent Tools (6 tools)

- [ ] Implement `read_file` tool with Zod schema
- [ ] Implement `semantic_code_search` tool
- [ ] Implement `parse_code_structure` tool
- [ ] Implement `get_dependency_graph` tool
- [ ] Implement `github_api` tool
- [ ] Implement `git_blame` tool
- [ ] Add timeout protection per tool (30 second max)
- [ ] Add error handling (return error message as string, not throw)
- [ ] Tools return string output (LLM-friendly)

**agents/tools/file-read.tool.ts:**
```typescript
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { readFile } from "fs/promises";
import { join } from "path";

export function createFileReadTool(repoPath: string) {
  return new DynamicStructuredTool({
    name: "read_file",
    description:
      "Read the contents of a file in the repository. Use this to examine source code, configs, or documentation.",
    schema: z.object({
      filePath: z
        .string()
        .describe("Relative path to the file from repo root (e.g., 'src/auth/login.ts')"),
      startLine: z
        .number()
        .optional()
        .describe("Start line number (1-based). Omit to read entire file."),
      endLine: z
        .number()
        .optional()
        .describe("End line number (1-based). Omit to read to end."),
    }),
    func: async ({ filePath, startLine, endLine }) => {
      try {
        const fullPath = join(repoPath, filePath);
        const content = await readFile(fullPath, "utf-8");

        if (startLine || endLine) {
          const lines = content.split("\n");
          const start = (startLine || 1) - 1;
          const end = endLine || lines.length;
          return lines
            .slice(start, end)
            .map((line, i) => `${start + i + 1}: ${line}`)
            .join("\n");
        }

        // Add line numbers for full file reads
        return content
          .split("\n")
          .map((line, i) => `${i + 1}: ${line}`)
          .join("\n");
      } catch (error) {
        return `Error reading file ${filePath}: ${error.message}`;
      }
    },
  });
}
```

#### 3.2 Agent Orchestrator (LangGraph)

- [ ] Define `OrchestratorState` interface
- [ ] Implement `planAnalysis` node — LLM decides what to analyze based on repo context
- [ ] Implement `routeToAgent` conditional — picks next pending agent
- [ ] Implement `synthesizeResults` node — combines all findings
- [ ] Build `StateGraph` with conditional edges
- [ ] Error handling: if agent fails, mark as failed and continue to next
- [ ] Track total duration and cost

**agents/orchestrator.ts:**
```typescript
import { StateGraph, END } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";

export function createOrchestrator() {
  const graph = new StateGraph<OrchestratorState>({
    channels: {
      repoId: { value: (a: string, b?: string) => b ?? a },
      repoContext: { value: (a: any, b?: any) => b ?? a },
      plan: { value: (a: any, b?: any) => b ?? a },
      architectureResult: { value: (a: any, b?: any) => b ?? a },
      bugResults: { value: (a: any, b?: any) => b ?? a },
      docResult: { value: (a: any, b?: any) => b ?? a },
      refactorResults: { value: (a: any, b?: any) => b ?? a },
      finalSummary: { value: (a: any, b?: any) => b ?? a },
      currentAgent: { value: (a: string, b?: string) => b ?? a },
      errors: { value: (a: string[], b?: string[]) => [...(a || []), ...(b || [])] },
    },
  });

  // Nodes
  graph.addNode("plan", planAnalysis);
  graph.addNode("architect", runArchitectAgent);
  graph.addNode("bug_hunter", runBugHunterAgent);
  graph.addNode("doc_writer", runDocWriterAgent);
  graph.addNode("refactor", runRefactorAgent);
  graph.addNode("synthesize", synthesizeResults);

  // Edges
  graph.setEntryPoint("plan");
  graph.addConditionalEdges("plan", routeToAgent);
  graph.addConditionalEdges("architect", routeToAgent);
  graph.addConditionalEdges("bug_hunter", routeToAgent);
  graph.addConditionalEdges("doc_writer", routeToAgent);
  graph.addConditionalEdges("refactor", routeToAgent);
  graph.addEdge("synthesize", END);

  return graph.compile();
}

function routeToAgent(state: OrchestratorState): string {
  // Find next pending task
  const nextTask = state.plan.tasks.find((t) => t.status === "pending");
  if (!nextTask) return "synthesize";

  // Mark as running
  nextTask.status = "running";
  return nextTask.agent;
}
```

#### 3.3 Architect Agent

- [ ] System prompt: Senior Software Architect with ReAct instructions
- [ ] Uses all 6 tools, up to 25 iterations
- [ ] Reads minimum 10-15 key files
- [ ] Structured JSON output: projectPurpose, techStack, architecture pattern, modules, dataFlow, entryPoints, externalDependencies, concerns
- [ ] Stores findings in short-term memory for Bug Hunter to consume

#### 3.4 Bug Hunter Agent

- [ ] System prompt: Senior code reviewer + security expert
- [ ] Reads Architect's findings from shared memory FIRST
- [ ] Focuses on high-risk areas identified by Architect
- [ ] Categories: CRITICAL_BUG, SECURITY, BUG, CODE_SMELL, PERFORMANCE
- [ ] Only reports confidence >= 0.7
- [ ] Uses `git_blame` to check recency
- [ ] Structured JSON output per issue: severity, category, title, file, lineStart, lineEnd, description, impact, suggestedFix, confidence

#### 3.5 Doc Writer Agent

- [ ] System prompt: Technical documentation writer
- [ ] Generates: README.md, API documentation, architecture guide
- [ ] Bases everything on actual code
- [ ] Generates Mermaid diagrams for architecture
- [ ] Includes real code examples

#### 3.6 Refactor Agent

- [ ] System prompt: Refactoring advisor
- [ ] Looks for: long functions, duplication, complexity, god classes, outdated patterns, type safety, naming
- [ ] Structured output: priority, category, file, currentCode, suggestedCode, explanation, effort, impact

#### 3.7 Agent Memory (Redis Short-Term)

**agents/memory/short-term.ts:**
```typescript
import { redis } from "@/lib/redis";

export class ShortTermMemory {
  private prefix: string;

  constructor(repoId: string) {
    this.prefix = `repo:${repoId}:memory`;
  }

  async save(agentType: string, key: string, data: any): Promise<void> {
    await redis.hset(this.prefix, `${agentType}:${key}`, JSON.stringify(data));
    await redis.expire(this.prefix, 3600); // 1 hour TTL
  }

  async get(agentType: string, key: string): Promise<any | null> {
    const raw = await redis.hget(this.prefix, `${agentType}:${key}`);
    return raw ? JSON.parse(raw) : null;
  }

  async getAgentFindings(agentType: string): Promise<Record<string, any>> {
    const all = await redis.hgetall(this.prefix);
    const findings: Record<string, any> = {};
    for (const [fullKey, value] of Object.entries(all)) {
      if (fullKey.startsWith(`${agentType}:`)) {
        findings[fullKey.split(":")[1]] = JSON.parse(value);
      }
    }
    return findings;
  }
}
```

#### 3.8 Agent Step Tracking

**agents/tracking/agent-tracker.ts:**
```typescript
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

export class AgentTracker {
  private agentRunId: string;
  private repoId: string;
  private stepCounter = 0;

  constructor(agentRunId: string, repoId: string) {
    this.agentRunId = agentRunId;
    this.repoId = repoId;
  }

  async trackStep(step: {
    type: "thought" | "tool_call" | "tool_result" | "response";
    content: any;
    tokenCount?: number;
    duration?: number;
  }): Promise<void> {
    this.stepCounter++;

    // Save to DB
    await prisma.agentStep.create({
      data: {
        agentRunId: this.agentRunId,
        stepNumber: this.stepCounter,
        type: step.type,
        content: step.content,
        tokenCount: step.tokenCount,
        duration: step.duration,
      },
    });

    // Emit real-time via Redis pub/sub → SSE
    await redis.publish(
      `repo:${this.repoId}:progress`,
      JSON.stringify({
        stage: "analyzing",
        agentRunId: this.agentRunId,
        step: {
          number: this.stepCounter,
          type: step.type,
          summary: this.summarize(step),
        },
      })
    );
  }

  private summarize(step: any): string {
    switch (step.type) {
      case "thought":
        return step.content.text?.slice(0, 100) + "...";
      case "tool_call":
        return `Using ${step.content.tool}(${JSON.stringify(step.content.args).slice(0, 60)})`;
      case "tool_result":
        return `Got result from ${step.content.tool} (${step.content.result?.length || 0} chars)`;
      case "response":
        return "Producing final analysis...";
      default:
        return step.type;
    }
  }
}
```

### Deliverables
- 4 specialized AI agents with ReAct reasoning and OpenAI function calling
- LangGraph orchestrator coordinating all agents via state machine
- Agent short-term memory (Redis) for inter-agent communication
- Real-time step tracking via SSE
- All agent results stored in Analysis table with full traces in AgentStep

### Key Files
```
agents/orchestrator.ts
agents/architect.agent.ts
agents/bug-hunter.agent.ts
agents/doc-writer.agent.ts
agents/refactor.agent.ts
agents/tools/file-read.tool.ts
agents/tools/vector-search.tool.ts
agents/tools/ast-parse.tool.ts
agents/tools/dep-graph.tool.ts
agents/tools/github-api.tool.ts
agents/tools/git-blame.tool.ts
agents/memory/short-term.ts
agents/memory/long-term.ts
agents/tracking/agent-tracker.ts
workers/analysis.worker.ts
prompts/orchestrator.prompt.md
prompts/architect.prompt.md
prompts/bug-hunter.prompt.md
prompts/doc-writer.prompt.md
prompts/refactor.prompt.md
```

---

## Phase 4 — Interactive Chat Agent (Week 9-10)

### Goal
Conversational Q&A with streaming, tool use visibility, source citations, conversation persistence.

### Tasks

#### 4.1 Chat Agent

- [ ] Create tool-using agent with GPT-4o streaming
- [ ] System prompt: RepoInsight Chat assistant for the specific repo
- [ ] Tools: read_file, semantic_code_search, parse_code_structure, get_dependency_graph
- [ ] Inject repo context (architecture summary, known bugs) into system prompt
- [ ] Conversation memory: last 20 messages
- [ ] Always cite source files in responses
- [ ] Max 10 tool iterations per response

#### 4.2 Streaming Chat API (SSE)

- [ ] `POST /api/repos/[id]/chat` with SSE response
- [ ] Stream event types: `token`, `tool_use`, `tool_result`, `sources`, `suggestions`, `done`
- [ ] Save messages to Conversation/Message tables after completion
- [ ] Generate conversation title from first message

#### 4.3 Frontend Chat UI

- [ ] Message bubbles with markdown rendering (react-markdown + Shiki)
- [ ] "Agent is thinking..." indicator with tool call visibility
- [ ] Live tool use display: "Reading src/auth.ts..."
- [ ] Source citations as clickable links
- [ ] Suggested follow-up questions (3 suggestions after each response)
- [ ] Conversation history sidebar
- [ ] New conversation / continue conversation
- [ ] Auto-scroll to latest message
- [ ] Input bar with submit on Enter, Shift+Enter for newline

### Key Files
```
agents/chat.agent.ts
app/api/repos/[id]/chat/route.ts
app/api/repos/[id]/conversations/route.ts
app/(dashboard)/repo/[id]/chat/page.tsx
components/chat/chat-container.tsx
components/chat/message-bubble.tsx
components/chat/chat-input.tsx
components/chat/tool-use-indicator.tsx
components/chat/source-citation.tsx
components/chat/suggested-questions.tsx
components/chat/conversation-sidebar.tsx
hooks/use-chat.ts
stores/chat.store.ts
```

---

## Phase 5 — Frontend Dashboard (Week 11-12)

### Goal
Beautiful, functional UI that showcases the AI agents and their reasoning.

### Tasks

#### 5.1 Repository Overview Page

- [ ] Repository header: name, URL, status badge, tech stack badges, last analyzed date
- [ ] Stats cards: file count, total lines, language breakdown (pie chart), issue count
- [ ] Quick summary from Architect agent
- [ ] Navigation tabs to sub-pages
- [ ] "Re-analyze" button

#### 5.2 Architecture View

- [ ] Project purpose section
- [ ] Tech stack grid with framework icons/badges
- [ ] Architecture pattern card (Monolith, MVC, Microservices, Serverless, etc.)
- [ ] Module breakdown cards (name, purpose, key files, dependencies)
- [ ] Mermaid diagrams rendered inline (architecture overview, data flow)
- [ ] Entry points list (API routes, CLI commands, web pages)
- [ ] External dependencies table (name, purpose, critical flag)
- [ ] Architectural concerns/recommendations section

#### 5.3 Bug Report View

- [ ] Summary stats bar: total issues, critical, high, medium, low
- [ ] Severity filter buttons: All | Critical | High | Medium | Low
- [ ] Category tabs: All | Security | Bugs | Code Smells | Performance
- [ ] Expandable bug cards:
  - Severity badge (color-coded)
  - Issue title
  - File path + line range (clickable → opens code viewer)
  - Description
  - Impact explanation
  - Code snippet with syntax highlighting (problematic lines highlighted)
  - Suggested fix with diff view
  - Confidence score progress bar
  - "Generate Fix" button (Phase 6)
- [ ] Sortable by: severity, confidence, file, date
- [ ] Search/filter by file path

#### 5.4 Security View

- [ ] Same layout as bugs but filtered to SECURITY category
- [ ] OWASP category badges
- [ ] Higher prominence for critical security issues

#### 5.5 Refactoring View

- [ ] Suggestion cards grouped by category (decomposition, duplication, complexity, naming, types)
- [ ] Current code vs suggested code (side-by-side diff viewer)
- [ ] Effort estimate badges (small/medium/large)
- [ ] Priority indicators (high/medium/low)
- [ ] "Apply Fix" button (Phase 6)

#### 5.6 Documentation View

- [ ] Tabbed view: README | API Docs | Architecture Guide
- [ ] Markdown preview with syntax highlighting
- [ ] Edit mode (CodeMirror or textarea with markdown preview)
- [ ] Download as .md file
- [ ] Copy to clipboard button
- [ ] "Create PR with docs" button (Phase 6)

#### 5.7 Agent Logs View

- [ ] List of all agent runs with: agent type, status, duration, cost, date
- [ ] Click into a run → full reasoning trace timeline:
  - Thought bubbles (agent's reasoning text)
  - Tool call cards (tool name, arguments, result summary)
  - Response output (final structured result)
- [ ] Token usage per step
- [ ] Duration per step
- [ ] Total cost breakdown (per agent + overall)
- [ ] This is the KEY demo feature — proves the AI is actually reasoning

#### 5.8 Shared Components

- [ ] Code viewer (Shiki syntax highlighting, line numbers, line highlighting)
- [ ] Diff viewer (side-by-side, unified diff mode toggle)
- [ ] Mermaid renderer (mermaid.js, with loading fallback)
- [ ] File tree browser (collapsible, language icons)
- [ ] Markdown renderer (react-markdown + rehype plugins)
- [ ] Loading skeletons for all views
- [ ] Error boundaries with retry
- [ ] Toast notifications (sonner)

### Key Files
```
app/(dashboard)/repo/[id]/page.tsx
app/(dashboard)/repo/[id]/architecture/page.tsx
app/(dashboard)/repo/[id]/bugs/page.tsx
app/(dashboard)/repo/[id]/security/page.tsx
app/(dashboard)/repo/[id]/refactor/page.tsx
app/(dashboard)/repo/[id]/docs/page.tsx
app/(dashboard)/repo/[id]/agent-logs/page.tsx
components/analysis/overview-stats.tsx
components/analysis/architecture-view.tsx
components/analysis/bug-report-table.tsx
components/analysis/bug-card.tsx
components/analysis/refactor-suggestion.tsx
components/analysis/docs-viewer.tsx
components/agents/activity-feed.tsx
components/agents/reasoning-trace.tsx
components/agents/step-card.tsx
components/agents/cost-breakdown.tsx
components/shared/code-viewer.tsx
components/shared/diff-viewer.tsx
components/shared/mermaid-renderer.tsx
components/shared/markdown-renderer.tsx
```

---

## Phase 6 — PR Assistant & GitHub Integration (Week 13-14)

### Goal
Generate code fixes from bug reports and create pull requests directly on GitHub.

### Tasks

#### 6.1 Fix Generation Agent

- [ ] Takes bug report + file content as input
- [ ] Generates precise code changes: `{ file, lineStart, lineEnd, oldCode, newCode, explanation }`
- [ ] Supports multi-file fixes
- [ ] Uses GPT-4o with temperature=0 for deterministic output

#### 6.2 GitHub PR Creation Service

- [ ] Use user's decrypted GitHub token via Octokit
- [ ] Create branch: `repoinsight/fix-{timestamp}`
- [ ] Apply fixes as commits
- [ ] Create PR with AI-generated title and description
- [ ] Description includes: what was fixed, why, which agent found it, confidence score

#### 6.3 Frontend — PR Builder

- [ ] Diff preview page (side-by-side)
- [ ] Select which fixes to include (checkbox per fix)
- [ ] Edit PR title and description before submitting
- [ ] Submit → creates PR → shows GitHub PR URL
- [ ] PR status tracking link

### Key Files
```
agents/fix-generator.agent.ts
services/github-pr.service.ts
app/api/repos/[id]/fix/route.ts
app/api/repos/[id]/pr/route.ts
app/(dashboard)/repo/[id]/pr-builder/page.tsx
components/pr/diff-preview.tsx
components/pr/fix-selector.tsx
components/pr/pr-form.tsx
```

---

## Phase 7 — Production Polish (Week 15-16)

### Goal
Cost optimization, security hardening, observability, production deployment.

### Tasks

#### 7.1 Cost Optimization

- [ ] Smart model routing: GPT-4o for complex reasoning, GPT-4o-mini for simple tasks
- [ ] Token tracking per agent run with cost calculation
- [ ] Cost dashboard: per-analysis and aggregate
- [ ] Analysis result caching in Redis (serve from cache on repeat views)
- [ ] Repo size limits: 500MB max, 10k files max

**services/cost-tracker.service.ts:**
```typescript
const MODEL_RATES = {
  "gpt-4o": { input: 2.50 / 1_000_000, output: 10.00 / 1_000_000 },
  "gpt-4o-mini": { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },
  "text-embedding-3-small": { input: 0.02 / 1_000_000, output: 0 },
};

export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const rates = MODEL_RATES[model] || MODEL_RATES["gpt-4o"];
  return promptTokens * rates.input + completionTokens * rates.output;
}
```

#### 7.2 Rate Limiting

- [ ] Per-user rate limits based on plan tier
- [ ] Free: 3 repos/month, 5 agent runs/day, 20 chat messages/day
- [ ] Pro: Unlimited repos, 50 agent runs/day, 200 chat messages/day
- [ ] Rate limit middleware using Upstash Redis
- [ ] Friendly error messages with upgrade CTA

#### 7.3 Security Hardening

- [ ] GitHub tokens encrypted at rest (AES-256-GCM) — done in Phase 1
- [ ] Sanitize cloned repos: no binary execution, no symlink following
- [ ] Input validation with Zod on ALL API routes
- [ ] CORS configuration: whitelist frontend origin
- [ ] Security headers via `next.config.ts`
- [ ] Rate limit OpenAI API calls to prevent cost overruns
- [ ] No execution of cloned code (tree-sitter is read-only parsing)
- [ ] Secret file detection: skip .env, credentials, key files during indexing

#### 7.4 LangSmith Integration

- [ ] Enable tracing: `LANGCHAIN_TRACING_V2=true`
- [ ] Track every LLM call, tool use, chain execution
- [ ] Monitor: token usage, latency per step, error rates
- [ ] Set up evaluation datasets for agent quality testing

#### 7.5 Error Tracking & Monitoring

- [ ] Sentry integration (frontend + API routes + worker)
- [ ] PostHog analytics (page views, feature usage, funnels)
- [ ] BetterStack uptime monitoring
- [ ] Structured JSON logging with pino
- [ ] Health check endpoint: `/api/health`

#### 7.6 Deployment

- [ ] Deploy frontend to Vercel (connect GitHub repo)
- [ ] Deploy worker to Railway (Dockerfile)
- [ ] Set up Supabase project (Postgres)
- [ ] Set up Upstash Redis instance
- [ ] Set up Pinecone index (dimension: 1536, metric: cosine)
- [ ] Configure all environment variables
- [ ] Set up custom domain
- [ ] SSL/TLS everywhere (automatic via Vercel/Railway)

---

## Testing Strategy

### Unit Tests

| What | Tool | Coverage Target |
|------|------|----------------|
| Utility functions (crypto, batch, etc.) | Vitest | 90%+ |
| Zod schemas (API input validation) | Vitest | 100% |
| Chunker logic (semantic boundaries) | Vitest | 85%+ |
| RRF fusion algorithm | Vitest | 90%+ |
| Cost calculator | Vitest | 100% |

### Integration Tests

| What | Tool | Scope |
|------|------|-------|
| API route handlers | Vitest + supertest | Auth, CRUD, validation |
| Database operations | Vitest + Prisma (test DB) | Queries, relations, cascades |
| Ingestion pipeline | Vitest | Clone → parse → chunk (with fixture repo) |

### E2E Tests

| What | Tool | Scope |
|------|------|-------|
| Login flow | Playwright | OAuth redirect → dashboard |
| Submit repo → progress → results | Playwright | Full user journey |
| Chat interaction | Playwright | Send message → streaming response |

### Agent Tests (LangSmith Evaluation)

| What | How |
|------|-----|
| Architect accuracy | Feed 10 known repos. Compare output to manual analysis. Score: completeness, accuracy. |
| Bug Hunter precision | Feed repos with known bugs. Measure true positive rate. Target: >80%. |
| Chat citation accuracy | Ask 50 questions. Verify citations point to relevant code. Target: >90%. |

---

## Deployment Architecture

```
Production:

┌─────────────────┐      ┌────────────────────┐      ┌──────────────┐
│   Vercel         │      │   Railway           │      │  Supabase     │
│                  │      │                     │      │               │
│   Next.js App    │──────│   Worker Process    │──────│  PostgreSQL   │
│   (Frontend +    │      │   (BullMQ workers)  │      │  (Database)   │
│    API Routes)   │      │                     │      │               │
│                  │      │   Dockerfile:       │      │  Connection   │
│   Edge +         │      │   FROM node:20      │      │  Pooling via  │
│   Serverless     │      │   COPY . .          │      │  PgBouncer    │
│                  │      │   CMD node workers/ │      │               │
└────────┬────────┘      └─────────┬───────────┘      └──────────────┘
         │                         │
         │            ┌────────────┴───────────┐
         │            │                        │
    ┌────▼────────┐  ┌▼──────────────┐  ┌─────▼───────┐
    │  Upstash    │  │  Pinecone      │  │  OpenAI API  │
    │  (Redis)    │  │  (Vectors)     │  │              │
    │             │  │                │  │  GPT-4o      │
    │  Queue      │  │  Per-repo      │  │  GPT-4o-mini │
    │  Memory     │  │  namespaces    │  │  Embeddings  │
    │  Cache      │  │                │  │              │
    │  Rate Limit │  │  1536-dim      │  └──────────────┘
    └─────────────┘  │  cosine metric │
                     └────────────────┘

Monitoring:
┌──────────┐  ┌───────────┐  ┌────────────┐  ┌────────────┐
│  Sentry   │  │ LangSmith  │  │  PostHog   │  │ BetterStack│
│  (Errors) │  │ (LLM Trace)│  │ (Analytics)│  │ (Uptime)   │
└──────────┘  └───────────┘  └────────────┘  └────────────┘
```

---

## Environment Variables

```env
# ─── AI / LLM ────────────────────────────────
OPENAI_API_KEY=sk-...

# ─── Vector Database ─────────────────────────
PINECONE_API_KEY=...
PINECONE_INDEX=repoinsight

# ─── Database ────────────────────────────────
DATABASE_URL=postgresql://repoinsight:password@localhost:5432/repoinsight

# ─── Redis ───────────────────────────────────
REDIS_URL=redis://localhost:6379
# For production (Upstash):
# UPSTASH_REDIS_REST_URL=...
# UPSTASH_REDIS_REST_TOKEN=...

# ─── GitHub OAuth ────────────────────────────
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
NEXTAUTH_SECRET=...                          # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000

# ─── Encryption ──────────────────────────────
TOKEN_ENCRYPTION_KEY=...                     # openssl rand -hex 32

# ─── Observability ───────────────────────────
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=ls__...
LANGCHAIN_PROJECT=repoinsight

SENTRY_DSN=...
NEXT_PUBLIC_SENTRY_DSN=...

NEXT_PUBLIC_POSTHOG_KEY=...
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# ─── App ─────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
WORKER_CONCURRENCY=3                         # Parallel ingestion jobs
```

---

## Day 1 — Getting Started

```bash
# 1. You already have the Next.js 16 scaffold at /repoinsight
cd /home/yusuf/Desktop/agentic-ai/repoinsight

# 2. Start local databases
docker compose up -d

# 3. Install dependencies
pnpm add prisma @prisma/client next-auth@5 zustand zod \
  class-variance-authority clsx tailwind-merge lucide-react sonner \
  @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-dropdown-menu \
  @radix-ui/react-tabs @radix-ui/react-tooltip @radix-ui/react-progress

pnpm add openai @langchain/openai @langchain/core @langchain/langgraph langchain \
  @pinecone-database/pinecone bullmq ioredis simple-git @octokit/rest \
  react-markdown rehype-raw rehype-sanitize remark-gfm shiki recharts mermaid pino

pnpm add -D @types/node tsx vitest @playwright/test

# 4. Initialize Prisma
npx prisma init
# → Paste schema from Section 4 into prisma/schema.prisma

# 5. Create .env.local from .env.example
cp .env.example .env.local
# → Fill in: OPENAI_API_KEY, DATABASE_URL, REDIS_URL, GITHUB_CLIENT_ID, etc.

# 6. Run first migration
npx prisma migrate dev --name init

# 7. Start developing
pnpm dev
```

### First 4 Hours Checklist

```
□ Docker Compose running (Postgres + Redis)
□ Prisma schema written and migrated
□ NextAuth.js configured (GitHub OAuth)
□ Login page rendering
□ Dashboard layout with sidebar
□ .env.local populated with API keys
□ Can log in with GitHub and see dashboard
```

---

## Timeline Summary

| Phase | What | Weeks | Key Technical Concepts |
|-------|------|-------|----------------------|
| **1** | Foundation & Auth | 1-2 | Next.js 16, Prisma, NextAuth, GitHub OAuth, AES-256 encryption |
| **2** | Ingestion Pipeline | 3-4 | tree-sitter, semantic chunking, OpenAI embeddings, Pinecone, hybrid retrieval, RRF, BullMQ, SSE |
| **3** | **Agentic AI Core** | **5-8** | **LangGraph, ReAct agents, OpenAI function calling, multi-agent orchestration, agent memory, tool use** |
| **4** | Chat Agent | 9-10 | Conversational RAG, SSE streaming, visible reasoning, source citations |
| **5** | Dashboard UI | 11-12 | shadcn/ui, Mermaid diagrams, code viewer, diff viewer, agent trace visualization |
| **6** | PR Assistant | 13-14 | Diff generation, Octokit PR creation, GitHub API integration |
| **7** | Production Polish | 15-16 | Cost optimization, model routing, LangSmith, Sentry, deployment |

**Total: 16 weeks (4 months)**

---

## Estimated Costs

| Service | Development | Production |
|---------|------------|------------|
| OpenAI GPT-4o | ~$5-10/mo | $100-300/mo |
| OpenAI Embeddings | ~$1/mo | $20-50/mo |
| Pinecone | Free tier | $70/mo |
| Supabase (Postgres) | Free tier | $25/mo |
| Upstash (Redis) | Free tier | $10/mo |
| Vercel | Free | $20/mo |
| Railway | $5/mo | $20/mo |
| LangSmith | Free tier | $39/mo |
| Sentry | Free tier | $26/mo |
| **Total** | **~$11-16** | **~$330-560** |

---

*End of Implementation Plan*
