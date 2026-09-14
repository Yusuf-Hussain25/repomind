# RepoInsight — Product Requirements Document (PRD)

**Version:** 1.0
**Author:** Engineering Team
**Date:** 2026-03-26
**Status:** Draft

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Vision & Mission](#3-vision--mission)
4. [Target Users & Personas](#4-target-users--personas)
5. [User Stories & Jobs-to-be-Done](#5-user-stories--jobs-to-be-done)
6. [Feature Requirements](#6-feature-requirements)
7. [User Flows](#7-user-flows)
8. [Information Architecture](#8-information-architecture)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [Success Metrics & KPIs](#10-success-metrics--kpis)
11. [Risk Assessment](#11-risk-assessment)
12. [Competitive Analysis](#12-competitive-analysis)
13. [Monetization Strategy](#13-monetization-strategy)
14. [Release Strategy](#14-release-strategy)
15. [Open Questions & Decisions](#15-open-questions--decisions)

---

## 1. Executive Summary

**RepoInsight** is an AI-powered platform that autonomously analyzes GitHub repositories using a multi-agent system. Users paste a GitHub URL and receive deep, actionable insights: architecture mapping, bug detection, security vulnerability scanning, refactoring suggestions, auto-generated documentation, and an interactive Q&A chat — all powered by specialized AI agents that reason, use tools, collaborate, and explain their work.

This is not another "send code to GPT" wrapper. RepoInsight deploys **autonomous AI agents** that plan their own analysis strategy, call tools (file reading, AST parsing, semantic search, dependency graph traversal), share findings with each other, self-correct on failure, and produce structured, verifiable results with full reasoning traces visible to the user.

### Why Now?

- **Developer pain is real:** GitHub's 2023 survey found developers spend 40%+ of their time understanding unfamiliar codebases. The rise of open-source dependencies, microservices, and remote teams has made this worse.
- **AI capabilities have matured:** GPT-4o's function calling, LangGraph's stateful agent orchestration, and production-grade vector databases (Pinecone) make autonomous multi-agent systems viable for the first time.
- **Market gap:** Existing tools (SonarQube, CodeClimate, Codacy) focus on static analysis rules. None use AI agents that actually *read and reason* about code the way a senior engineer would.

---

## 2. Problem Statement

### The Core Problem

When a developer encounters an unfamiliar codebase — new job, new open-source project, inherited legacy system, code review of a large PR — they face a brutal onboarding curve:

1. **"What does this project even do?"** — No README, outdated README, or README that describes the project from 3 years ago
2. **"How is this organized?"** — Hundreds of files, unclear module boundaries, spaghetti imports
3. **"Where are the bodies buried?"** — Hidden bugs, security holes, technical debt that only the original author knew about
4. **"How do I change X without breaking Y?"** — No architecture docs, no dependency maps, no test coverage insight
5. **"Who do I ask?"** — The original author left the company. The Slack thread is from 2022. The Jira ticket says "TODO."

### The Impact

| Stakeholder | Pain | Cost |
|------------|------|------|
| **Individual Developer** | Hours/days wasted reading code manually, fear of breaking things | Burnout, slow velocity, imposter syndrome |
| **Engineering Teams** | Onboarding takes 1-3 months, knowledge silos, bus factor risk | Missed deadlines, team friction, attrition |
| **Open Source Maintainers** | New contributors can't understand the codebase, low contribution quality | Contributor drop-off, maintainer burnout |
| **Engineering Managers** | Can't assess codebase health, hidden technical debt surprises | Unexpected refactoring sprints, cost overruns |
| **Freelancers/Consultants** | Must understand client codebases fast to deliver value | Lost billable hours, scope creep |

### What Exists Today (And Why It's Not Enough)

| Tool | What It Does | What It Misses |
|------|-------------|---------------|
| **SonarQube / CodeClimate** | Rule-based static analysis (linting, complexity scores) | No semantic understanding — can't explain *why* code exists or how modules relate |
| **GitHub Copilot Chat** | Answer questions about open files | No whole-repo understanding, no autonomous analysis, no persistent knowledge |
| **CodeScene** | Behavioral code analysis (hotspots, coupling) | Expensive, enterprise-only, no AI reasoning |
| **ChatGPT / Claude** | Paste code → get analysis | Context window limits, no tool use, no repo-wide understanding, no persistence |
| **README generators** | Template-based docs | No actual code understanding, generates generic boilerplate |

**The gap:** No tool combines *autonomous AI reasoning* + *whole-repo understanding* + *structured, actionable output* + *interactive follow-up*.

---

## 3. Vision & Mission

### Vision
> Every developer understands any codebase in minutes, not months — powered by AI agents that think like senior engineers.

### Mission
> Build an AI-powered platform where specialized agents autonomously analyze GitHub repositories — mapping architecture, hunting bugs, generating documentation, and answering questions — so developers can focus on building, not deciphering.

### Product Principles

1. **Depth over breadth** — One repo analyzed thoroughly beats ten repos analyzed superficially. Agents should read 15+ key files, not skim.
2. **Show your work** — Every finding must be traceable to actual code. Every agent step (thinking, tool use, observation) is visible. No black boxes.
3. **Actionable, not academic** — Every bug report includes a fix. Every refactoring suggestion includes the code. Every doc is copy-paste ready.
4. **Speed matters** — Full analysis in under 3 minutes for a typical repo (~500 files). Chat responses in under 5 seconds.
5. **Trust through transparency** — Confidence scores on every finding. Source citations on every answer. Agent reasoning traces for verification.

---

## 4. Target Users & Personas

### Persona 1: "The New Hire" — Priya, Junior-Mid Developer

| Attribute | Detail |
|-----------|--------|
| **Role** | Software Engineer, 1-3 years experience |
| **Context** | Just joined a new company, inheriting a 200k-line TypeScript monorepo |
| **Goals** | Understand project architecture, find her way around, ship her first PR confidently |
| **Frustrations** | Outdated docs, no one has time to explain, afraid of breaking things |
| **How RepoInsight helps** | Architecture map shows her the big picture in 2 minutes. Chat agent answers "how does auth work here?" with file citations. Bug reports show her what to avoid. |
| **Willingness to pay** | Free tier is enough initially; her company might pay for Pro |

### Persona 2: "The Tech Lead" — Marcus, Senior Engineer / Tech Lead

| Attribute | Detail |
|-----------|--------|
| **Role** | Tech Lead, 7+ years experience, manages team of 5-8 |
| **Context** | Evaluating codebases for acquisition due diligence, assessing open-source dependencies, reviewing large PRs |
| **Goals** | Quick health assessment, identify risks before they become production incidents |
| **Frustrations** | No time to deep-dive every dependency. Static analysis tools produce noise. Wants senior-engineer-level judgment. |
| **How RepoInsight helps** | Bug Hunter finds the XSS vulnerability in the auth middleware. Architecture agent identifies the god-class that's a refactoring time bomb. Cost: 2 minutes vs 2 days. |
| **Willingness to pay** | Pro plan ($19/mo) is trivial compared to engineering time saved |

### Persona 3: "The Open Source Explorer" — Aisha, Full-Stack Developer

| Attribute | Detail |
|-----------|--------|
| **Role** | Full-stack developer, active OSS contributor |
| **Context** | Wants to contribute to a new open-source project but the codebase is intimidating |
| **Goals** | Understand project structure, find good first issues, understand coding conventions |
| **Frustrations** | CONTRIBUTING.md says "read the code." 2000 files. No architecture docs. |
| **How RepoInsight helps** | Architecture summary explains the project in plain English. Doc Writer generates the missing README. Chat answers "where would I add a new API endpoint?" |
| **Willingness to pay** | Free tier (3 repos/month) |

### Persona 4: "The Security Auditor" — James, Security Engineer

| Attribute | Detail |
|-----------|--------|
| **Role** | Application Security Engineer, performs internal code audits |
| **Context** | Needs to audit 3-5 repos per sprint for security vulnerabilities |
| **Goals** | Find injection points, auth bypasses, exposed secrets, insecure dependencies |
| **Frustrations** | SAST tools find regex-pattern issues but miss logic bugs. Manual review doesn't scale. |
| **How RepoInsight helps** | Bug Hunter with security expertise finds the SQL injection that SonarQube missed because it spans 3 files. Confidence scores prioritize real issues over noise. |
| **Willingness to pay** | Team/Enterprise plan |

### Persona 5: "The Freelancer" — Dev, Contract Developer

| Attribute | Detail |
|-----------|--------|
| **Role** | Freelance developer, picks up 2-3 client projects simultaneously |
| **Context** | Client hands over a repo with zero documentation. "Just add feature X." |
| **Goals** | Understand the codebase in 30 minutes, not 3 days. Minimize billable hours spent reading code. |
| **Frustrations** | Every project is a new codebase. No onboarding. No docs. No one to ask. |
| **How RepoInsight helps** | Full analysis in 3 minutes. Chat agent becomes the "senior dev who built this" that they can ask anything. |
| **Willingness to pay** | Pro plan — pays for itself on the first project |

---

## 5. User Stories & Jobs-to-be-Done

### Epic 1: Repository Onboarding

| ID | User Story | Priority | Acceptance Criteria |
|----|-----------|----------|-------------------|
| US-101 | As a developer, I want to paste a GitHub URL and get a complete analysis so I can understand the project quickly | P0 | URL validation, real-time progress, analysis complete in <3 min for repos under 500 files |
| US-102 | As a developer, I want to see the architecture of a repo (modules, data flow, entry points) so I can understand how it's organized | P0 | Architecture summary includes: project purpose, tech stack, module breakdown, data flow diagram (Mermaid), entry points, external dependencies |
| US-103 | As a developer, I want to see what technologies a repo uses so I can assess compatibility | P0 | Tech stack detected from package files, config files, and actual code usage — not just file extensions |
| US-104 | As a developer, I want to see a visual dependency graph between modules so I can understand coupling | P1 | Interactive graph showing which modules depend on which, with edge weights based on import count |

### Epic 2: Code Quality & Security

| ID | User Story | Priority | Acceptance Criteria |
|----|-----------|----------|-------------------|
| US-201 | As a tech lead, I want AI to find bugs in the codebase so I can fix them before they hit production | P0 | Bugs categorized by severity (critical/high/medium/low) with file path, line range, description, impact, and suggested fix |
| US-202 | As a security engineer, I want AI to find security vulnerabilities so I can patch them | P0 | OWASP Top 10 coverage: injection, broken auth, data exposure, XSS, CSRF, insecure deserialization, etc. |
| US-203 | As a developer, I want refactoring suggestions so I can improve code quality | P1 | Suggestions include: current code, improved code, explanation, effort estimate (small/medium/large) |
| US-204 | As a tech lead, I want severity-filtered views so I can prioritize what to fix first | P0 | Filterable by severity, category, confidence, file path |
| US-205 | As a developer, I want confidence scores on every finding so I can trust the results | P0 | Only findings with confidence >= 0.7 are shown. Confidence bar visible on each issue card. |

### Epic 3: Documentation Generation

| ID | User Story | Priority | Acceptance Criteria |
|----|-----------|----------|-------------------|
| US-301 | As a maintainer, I want AI to generate a README so new contributors can onboard faster | P1 | README includes: purpose, features, tech stack, installation, usage, project structure, env vars |
| US-302 | As a developer, I want API documentation generated from actual route definitions | P1 | Detects Express/FastAPI/etc routes. Generates: method, path, params, body, response, auth requirements |
| US-303 | As a developer, I want to edit generated docs before exporting | P1 | Markdown editor with preview. Download as .md. Copy to clipboard. |
| US-304 | As a developer, I want an architecture guide with Mermaid diagrams | P2 | System overview diagram, module interaction diagram, data flow diagram — all in Mermaid syntax, rendered inline |

### Epic 4: Interactive Q&A Chat

| ID | User Story | Priority | Acceptance Criteria |
|----|-----------|----------|-------------------|
| US-401 | As a developer, I want to ask questions about a repo and get accurate, cited answers | P0 | Streaming response, source file citations in every answer, tool use visible ("Reading src/auth.ts...") |
| US-402 | As a developer, I want the chat to remember our conversation context | P0 | Conversation persisted. Can resume later. Last 20 messages as context. |
| US-403 | As a developer, I want to see which files the AI read to answer my question | P1 | Source panel showing referenced files with line numbers |
| US-404 | As a developer, I want suggested follow-up questions so I can explore further | P2 | 3 suggested questions after each answer, contextual to what was just discussed |

### Epic 5: Agent Observability

| ID | User Story | Priority | Acceptance Criteria |
|----|-----------|----------|-------------------|
| US-501 | As a developer, I want to see what the AI agents are doing in real-time during analysis | P1 | Live feed: agent name, current step (thinking/reading file/searching), progress bar |
| US-502 | As a developer, I want to see the full reasoning trace after analysis completes | P1 | Timeline: each thought, tool call (with args), tool result (summarized), final output |
| US-503 | As a developer, I want to see how much the analysis cost (tokens/dollars) | P2 | Per-agent and total: prompt tokens, completion tokens, estimated cost |

### Epic 6: GitHub Integration

| ID | User Story | Priority | Acceptance Criteria |
|----|-----------|----------|-------------------|
| US-601 | As a developer, I want to log in with GitHub so I can analyze private repos | P0 | GitHub OAuth, token stored encrypted, used for repo access |
| US-602 | As a developer, I want to generate fix PRs from bug reports | P2 | Select bug → preview diff → one-click PR creation on GitHub |
| US-603 | As a developer, I want to create doc PRs from generated documentation | P2 | Select generated docs → preview → create PR with docs added |

---

## 6. Feature Requirements

### 6.1 Core Features (MVP — P0)

#### F1: GitHub Authentication
- Login with GitHub OAuth 2.0
- Securely store and encrypt GitHub access tokens (AES-256-GCM)
- Access both public and private repositories using the user's token
- Session management with NextAuth.js
- Logout + token revocation

#### F2: Repository Ingestion Pipeline
- Accept any valid GitHub repository URL (public or private with user's token)
- Validate URL format and repo accessibility before queuing
- Shallow clone (`--depth 1`) to minimize bandwidth and storage
- Parse all source code files using tree-sitter for language-agnostic AST extraction
- Smart semantic chunking: chunk by function, class, and module boundaries (not naive token splitting)
- Generate embeddings via OpenAI `text-embedding-3-small`
- Store vectors in Pinecone with rich metadata (repoId, filePath, language, type, name, lineRange)
- Pipeline stages with real-time progress: `PENDING → CLONING → PARSING → EMBEDDING → ANALYZING → READY`
- Emit progress events via Server-Sent Events (SSE) to frontend
- Automatic cleanup of cloned repos after indexing
- Support for: JavaScript, TypeScript, Python, Go, Java, Rust, Ruby, PHP, C#, C/C++, Swift, Kotlin

#### F3: Multi-Agent Analysis System

**Agent Orchestrator (LangGraph)**
- Plans which analyses to run based on repo characteristics
- Dispatches to specialized agents in optimal order
- Collects and synthesizes results
- Handles agent failures gracefully (skip failed agent, continue with others)
- Tracks all steps for observability

**Architect Agent**
- Produces: project purpose, detected tech stack, architecture pattern (MVC/microservices/monolith/serverless), module breakdown with responsibilities, data flow description, entry points, external dependencies with roles, architectural concerns
- Uses tools: file_read, semantic_code_search, parse_code_structure, get_dependency_graph, github_api
- ReAct pattern: Think → Act (tool call) → Observe → Repeat
- Reads minimum 10-15 key files before producing output
- Stores findings in shared memory for other agents to consume

**Bug Hunter Agent**
- Produces: categorized issues (CRITICAL_BUG, SECURITY, BUG, CODE_SMELL, PERFORMANCE) with severity, file location, line range, description, impact, suggested fix, confidence score
- Cross-references with architect agent's findings via shared memory
- Focuses on high-risk areas: authentication, data handling, API endpoints, database queries
- Checks for OWASP Top 10 vulnerabilities
- Uses git_blame to assess recency of issues
- Only reports issues with confidence >= 0.7

**Doc Writer Agent**
- Generates: README.md, API documentation, architecture guide with Mermaid diagrams
- Bases everything on actual code (never invents features)
- Includes real code examples from the repo
- Matches existing documentation style if any exists

**Refactor Agent**
- Identifies: long functions (>50 lines), duplicated code, complex conditionals, god classes, missing error handling, outdated patterns, type safety issues, naming problems
- Per suggestion: priority, category, current code, suggested code, explanation, effort estimate, impact

#### F4: Interactive Chat
- Streaming responses via Server-Sent Events
- Tool-using agent that can read files, search code, parse structure, traverse dependencies
- Conversation history persistence (last 20 messages as context)
- Source citations in every answer with file path and line numbers
- Visible agent reasoning: "Reading src/auth.ts...", "Searching for login logic..."
- Context-aware: includes architecture summary and known bugs in system prompt

#### F5: Analysis Dashboard
- Repository list with status badges (analyzing/ready/failed)
- Per-repo views: Overview, Architecture, Bugs, Security, Refactoring, Documentation, Chat, Agent Logs
- Severity-filtered, sortable bug report table
- Expandable issue cards with code snippets and suggested fixes
- Mermaid diagram rendering for architecture visualizations
- Real-time agent activity feed during analysis

### 6.2 Enhanced Features (P1)

#### F6: Hybrid Retrieval
- Semantic search via Pinecone (vector similarity)
- Keyword search via PostgreSQL full-text search (ts_vector)
- Reciprocal Rank Fusion (RRF) to merge result sets
- Optional cross-encoder re-ranking for precision

#### F7: Agent Memory System
- **Short-term memory (Redis):** Agents share findings during a single analysis run. TTL: 1 hour.
- **Long-term memory (Pinecone):** Persist important repo insights as embeddings for future chat conversations.
- Any agent can read another agent's findings from shared memory.

#### F8: Agent Step Tracking & Observability
- Every agent step saved to database: thought, tool_call, tool_result, response
- Real-time updates via SSE
- Token count and duration per step
- Total cost breakdown per agent run and overall
- Agent reasoning trace viewer in the UI

### 6.3 Future Features (P2)

#### F9: Pull Request Assistant
- Generate code fixes from bug reports as unified diffs
- Preview diffs before creating PR
- One-click PR creation on GitHub via user's token
- AI-generated PR title and description

#### F10: Cost Optimization
- Smart model routing: GPT-4o for complex reasoning, GPT-4o-mini for simple tasks (10x cheaper)
- Token tracking with per-analysis cost transparency
- Analysis result caching in Redis

#### F11: Team Features
- Shared workspaces for team repositories
- Role-based access (admin, member, viewer)
- Team-wide analysis history

---

## 7. User Flows

### Flow 1: First-Time User (Login → First Analysis)

```
Landing Page
    │
    ├── User clicks "Get Started with GitHub"
    │
    ▼
GitHub OAuth Screen
    │
    ├── User authorizes RepoInsight
    │
    ▼
Dashboard (empty state)
    │
    ├── Prompt: "Paste a GitHub URL to get started"
    ├── User pastes: https://github.com/user/repo
    │
    ▼
URL Validation
    │
    ├── [Invalid] → Show error: "Not a valid GitHub repository URL"
    ├── [Private + No Access] → Show error: "Cannot access this repository"
    ├── [Valid] → Continue
    │
    ▼
Ingestion Progress Screen
    │
    ├── Stage 1: Cloning repository... ████░░░░░░ 25%
    ├── Stage 2: Parsing 342 files... ██████░░░░ 50%
    ├── Stage 3: Generating embeddings... ████████░░ 75%
    ├── Stage 4: AI agents analyzing... ██████████ 100%
    │
    │   [Real-time agent activity feed:]
    │   🔄 Orchestrator planning analysis...
    │   ✅ Plan: 4 agents scheduled
    │   🏗️ Architect Agent reading package.json...
    │   🏗️ Architect Agent searching for entry points...
    │   🐛 Bug Hunter Agent queued...
    │
    ▼
Repository Overview Page
    │
    ├── Project summary (from Architect Agent)
    ├── Tech stack badges
    ├── Stats: 342 files, 48,291 lines, 12 issues found
    ├── Quick nav: Architecture | Bugs (3 critical) | Docs | Chat
    │
    ▼
User explores tabs or starts chatting
```

### Flow 2: Chat Interaction

```
Chat Page (/repo/[id]/chat)
    │
    ├── User types: "How does authentication work in this project?"
    │
    ▼
Agent Processing (visible to user)
    │
    ├── 🔍 Searching codebase for "authentication"...
    ├── 📄 Reading src/middleware/auth.ts...
    ├── 📄 Reading src/routes/login.ts...
    ├── 🔍 Searching for "JWT" and "session"...
    ├── 📄 Reading src/lib/jwt.ts...
    │
    ▼
Streaming Response
    │
    ├── "Authentication in this project uses JWT tokens with..."
    ├── [Source: src/middleware/auth.ts:15-42]
    ├── [Source: src/lib/jwt.ts:8-23]
    │
    ├── Suggested follow-ups:
    │   • "What happens when a token expires?"
    │   • "How are refresh tokens handled?"
    │   • "Where is the login endpoint defined?"
    │
    ▼
User continues conversation or navigates to cited files
```

### Flow 3: Bug Investigation → Fix PR

```
Bugs Page (/repo/[id]/bugs)
    │
    ├── Filter: Severity = Critical + High
    ├── Found: 5 issues
    │
    ▼
Bug Card (expanded)
    │
    ├── 🔴 CRITICAL: SQL Injection in user search endpoint
    ├── File: src/routes/users.ts:45-52
    ├── Confidence: 0.95
    ├── Impact: "Attacker can extract entire database via crafted search query"
    ├── Code snippet (highlighted problem line)
    ├── Suggested fix (diff view)
    │
    ├── [Button: "Generate Fix PR"]
    │
    ▼
PR Builder Page
    │
    ├── Diff preview (side-by-side)
    ├── Select which fixes to include
    ├── Edit PR title: "fix: prevent SQL injection in user search"
    ├── Auto-generated PR description
    │
    ├── [Button: "Create Pull Request"]
    │
    ▼
PR Created → Link to GitHub PR
```

---

## 8. Information Architecture

### Site Map

```
/                                   Landing page (public)
├── /login                          GitHub OAuth login
├── /dashboard                      Repository list (protected)
│   └── /repo/[id]                  Repository overview
│       ├── /architecture           Architecture analysis
│       ├── /bugs                   Bug reports
│       ├── /security               Security vulnerabilities
│       ├── /refactor               Refactoring suggestions
│       ├── /docs                   Generated documentation
│       ├── /chat                   Interactive Q&A
│       ├── /agent-logs             Agent reasoning traces
│       └── /pr-builder             PR creation (from fixes)
├── /settings                       User settings
│   ├── /profile                    Account info
│   └── /billing                    Subscription management
└── /pricing                        Pricing page (public)
```

### Navigation Structure

```
┌──────────────────────────────────────────────────────┐
│  [Logo] RepoInsight          [Dashboard] [Settings]  │
├──────────────┬───────────────────────────────────────┤
│              │                                        │
│  Sidebar     │   Main Content Area                    │
│  ─────────   │                                        │
│  📊 Overview │   [Breadcrumb: Dashboard > repo-name]  │
│  🏗️ Architecture│                                     │
│  🐛 Bugs (5) │   [Content based on selected tab]     │
│  🔒 Security │                                        │
│  ♻️ Refactor  │                                        │
│  📝 Docs     │                                        │
│  💬 Chat     │                                        │
│  📋 Agent Logs│                                       │
│              │                                        │
│  ──────────  │                                        │
│  My Repos    │                                        │
│  • repo-1 ✅ │                                        │
│  • repo-2 🔄 │                                        │
│  • repo-3 ❌ │                                        │
│              │                                        │
│  [+ New Repo]│                                        │
│              │                                        │
└──────────────┴───────────────────────────────────────┘
```

---

## 9. Non-Functional Requirements

### 9.1 Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Repo cloning** | < 30 seconds for repos under 100MB | Time from queue to clone complete |
| **Code parsing** | < 60 seconds for 1000 files | Time to parse + build AST for all files |
| **Embedding generation** | < 90 seconds for 1000 chunks | Time to generate and store all embeddings |
| **Full analysis** | < 3 minutes for repos under 500 files | Total time from URL submission to READY status |
| **Chat response (first token)** | < 2 seconds | Time to first streamed token |
| **Chat response (complete)** | < 10 seconds | Time to complete response (excluding tool calls) |
| **Page load (dashboard)** | < 1.5 seconds | Largest Contentful Paint (LCP) |
| **API response (non-AI)** | < 200ms | p95 latency for CRUD endpoints |

### 9.2 Scalability

| Dimension | Initial Target | Scale Target |
|-----------|---------------|-------------|
| **Concurrent analyses** | 5 | 50 |
| **Stored repositories** | 1,000 | 100,000 |
| **Vector embeddings** | 1M vectors | 100M vectors |
| **Monthly active users** | 100 | 10,000 |
| **Chat messages/day** | 1,000 | 100,000 |

### 9.3 Security

| Requirement | Implementation |
|-------------|---------------|
| **Authentication** | GitHub OAuth 2.0 via NextAuth.js |
| **Token encryption** | AES-256-GCM at rest for GitHub tokens |
| **Data in transit** | TLS 1.3 everywhere |
| **Input validation** | Zod schemas on all API inputs |
| **Rate limiting** | Per-user, per-endpoint rate limits |
| **Repo sandboxing** | No execution of cloned code. No symlink following. No binary processing. |
| **Secret detection** | Skip files matching .env, credentials, keys patterns during indexing |
| **CORS** | Whitelist frontend origin only |
| **Headers** | Helmet.js security headers + Content Security Policy |
| **Dependency security** | Automated npm audit in CI |

### 9.4 Reliability

| Requirement | Target |
|-------------|--------|
| **Uptime** | 99.5% |
| **Data durability** | No data loss on service restart |
| **Error recovery** | Failed agent → skip and continue with remaining agents |
| **Graceful degradation** | If Pinecone is down → fall back to keyword-only search |
| **Queue persistence** | BullMQ jobs survive Redis restart |

### 9.5 Observability

| Component | Tool |
|-----------|------|
| **Error tracking** | Sentry (frontend + backend) |
| **LLM tracing** | LangSmith (every LLM call, tool use, chain) |
| **Usage analytics** | PostHog (page views, feature usage, funnels) |
| **Uptime monitoring** | BetterStack |
| **Cost monitoring** | Custom dashboard tracking OpenAI API spend |
| **Application logs** | Structured JSON logging (pino) |

### 9.6 Accessibility

| Requirement | Standard |
|-------------|----------|
| **WCAG compliance** | Level AA (WCAG 2.1) |
| **Keyboard navigation** | All interactive elements reachable via keyboard |
| **Screen reader** | Semantic HTML, ARIA labels, alt text |
| **Color contrast** | Minimum 4.5:1 ratio for text |
| **Focus indicators** | Visible focus rings on all interactive elements |
| **Responsive** | Fully functional on mobile, tablet, and desktop (320px — 2560px) |

---

## 10. Success Metrics & KPIs

### North Star Metric
> **Repositories analyzed per week** — measures core value delivery

### Primary Metrics

| Metric | Definition | Target (3 months) | Target (6 months) |
|--------|-----------|-------------------|-------------------|
| **Weekly Active Users (WAU)** | Users who log in and view at least one analysis | 200 | 1,000 |
| **Repos analyzed / week** | New repos submitted for analysis | 150 | 800 |
| **Analysis completion rate** | % of submitted repos that reach READY status | > 90% | > 95% |
| **Chat messages / week** | User messages sent in chat | 500 | 5,000 |
| **Free → Pro conversion** | % of free users who upgrade to Pro | 5% | 8% |

### Secondary Metrics

| Metric | Definition | Target |
|--------|-----------|--------|
| **Time to first insight** | Time from URL paste to first visible result | < 2 minutes |
| **Chat satisfaction** | Implicit: user asks follow-up (good) vs abandons (bad) | > 60% follow-up rate |
| **Bug fix acceptance** | % of generated fix PRs that get merged | > 30% |
| **Agent accuracy** | Manual review of sample findings: true positive rate | > 80% |
| **Session duration** | Average time spent per session | > 5 minutes |

### Quality Metrics

| Metric | Definition | Target |
|--------|-----------|--------|
| **False positive rate** | % of reported bugs that are not actually bugs | < 20% |
| **Citation accuracy** | % of chat citations that point to relevant code | > 90% |
| **Crash-free sessions** | % of sessions without unhandled errors | > 99% |
| **p95 analysis time** | 95th percentile time for full analysis | < 5 minutes |

---

## 11. Risk Assessment

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **LLM hallucination** — agent reports bugs that don't exist | HIGH | HIGH | Confidence threshold (>= 0.7), always cite source files, tool verification before reporting |
| **Large repos overwhelm the system** — 50k+ files, 1GB+ | MEDIUM | HIGH | Repo size limits (500MB, 10k files). Smart file filtering (skip binaries, node_modules, vendor). Progressive analysis. |
| **OpenAI API cost overruns** — agents make too many calls | MEDIUM | MEDIUM | Token budgets per agent run. Smart model routing (GPT-4o-mini for simple tasks). Cost tracking + alerts. |
| **Rate limiting by OpenAI** — 429 errors during batch embedding | MEDIUM | MEDIUM | Exponential backoff. Request queuing. Batch size tuning. |
| **tree-sitter parsing failures** — unsupported language or malformed code | LOW | LOW | Graceful fallback to regex-based extraction. Skip unparseable files. |
| **Pinecone cold starts** — slow first query after idle | LOW | LOW | Warm-up queries on deployment. Serverless tier handles this. |

### Product Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Users don't trust AI findings** | MEDIUM | HIGH | Transparency: show reasoning traces, confidence scores, source citations. Build trust incrementally. |
| **Analysis too slow for user patience** | MEDIUM | HIGH | Real-time progress. Partial results as agents complete. Target < 3 min. |
| **Free tier abuse** — users create multiple accounts | LOW | MEDIUM | GitHub account = identity. Flag duplicate GitHub IDs. |
| **Privacy concerns** — users worried about code being sent to OpenAI | MEDIUM | MEDIUM | Clear privacy policy. Option to delete all data. Repos deleted after indexing. |

### Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **GitHub Copilot adds similar features** | MEDIUM | HIGH | Differentiate on depth: multi-agent system, full-repo analysis, reasoning traces. Copilot optimizes for in-editor, we optimize for whole-repo. |
| **OpenAI pricing increases** | LOW | MEDIUM | Abstract LLM layer. Support multiple providers (OpenAI, Anthropic, Google). Model routing to minimize costs. |

---

## 12. Competitive Analysis

| Feature | RepoInsight | GitHub Copilot Chat | SonarQube | CodeClimate | Codacy |
|---------|------------|-------------------|-----------|------------|--------|
| **Whole-repo understanding** | ✅ Full repo analysis | ❌ Single file context | ❌ Rule-based per file | ❌ Rule-based | ❌ Rule-based |
| **AI reasoning** | ✅ Multi-agent with ReAct | ⚠️ Single LLM call | ❌ Static rules | ❌ Static rules | ❌ Static rules |
| **Architecture mapping** | ✅ Auto-generated | ❌ | ❌ | ❌ | ❌ |
| **Bug detection** | ✅ AI-powered + tool use | ⚠️ Basic suggestions | ✅ Rule-based | ✅ Rule-based | ✅ Rule-based |
| **Security scanning** | ✅ AI-powered | ❌ | ✅ Rules (OWASP) | ⚠️ Basic | ✅ Rules |
| **Documentation gen** | ✅ Full docs | ❌ | ❌ | ❌ | ❌ |
| **Interactive Q&A** | ✅ RAG + tool-using agent | ⚠️ Limited context | ❌ | ❌ | ❌ |
| **Agent observability** | ✅ Full trace viewer | ❌ | ❌ | ❌ | ❌ |
| **Fix PR generation** | ✅ One-click PRs | ⚠️ Suggestions only | ❌ | ❌ | ❌ |
| **Pricing** | Free + $19/mo | $10/mo (bundled) | $150+/mo | $200+/mo | Free + paid |
| **Setup time** | 0 min (paste URL) | Already in IDE | Hours (CI integration) | Hours | Hours |

### Our Competitive Edge

1. **Multi-agent reasoning** — Not one LLM call. Multiple specialized agents that plan, use tools, collaborate, and self-correct.
2. **Whole-repo context** — RAG pipeline with semantic chunking gives agents access to the entire codebase, not just the open file.
3. **Transparency** — Every finding is traceable. Every agent step is visible. No black box.
4. **Zero setup** — Paste a URL. No CI integration, no config files, no YAML.
5. **Actionable output** — Every bug comes with a fix. Every suggestion comes with code. Every doc is copy-paste ready.

---

## 13. Monetization Strategy

### Pricing Tiers

| | **Free** | **Pro** | **Team** |
|---|---------|---------|---------|
| **Price** | $0 | $19/mo | $49/mo per seat |
| **Repos / month** | 3 | Unlimited | Unlimited |
| **Agent runs / day** | 5 | 50 | 200 per seat |
| **Chat messages / day** | 20 | 200 | 500 per seat |
| **Private repos** | ❌ | ✅ | ✅ |
| **PR generation** | ❌ | ✅ | ✅ |
| **Agent reasoning traces** | Last 3 runs | Full history | Full history |
| **Priority queue** | Standard | Priority | Priority |
| **Team workspace** | ❌ | ❌ | ✅ |
| **Support** | Community | Email | Dedicated |

### Revenue Projections (Conservative)

| Month | Free Users | Pro Users | Team Seats | MRR |
|-------|-----------|-----------|-----------|-----|
| 3 | 500 | 25 | 0 | $475 |
| 6 | 2,000 | 100 | 20 | $2,880 |
| 12 | 8,000 | 400 | 100 | $12,500 |

### Cost Structure (Monthly at Scale)

| Cost | Amount |
|------|--------|
| OpenAI API (GPT-4o + embeddings) | $300-600 |
| Pinecone | $70-200 |
| Supabase (Postgres) | $25-50 |
| Upstash (Redis) | $10-30 |
| Vercel | $20-50 |
| Railway | $20-40 |
| LangSmith | $39 |
| Sentry | $26 |
| Domain + misc | $20 |
| **Total** | **$530-1,055** |

### Unit Economics
- **Cost per analysis:** ~$0.15-0.40 (embedding + 4 agent runs with smart model routing)
- **Pro user does ~15 analyses/month:** Cost = ~$4.50/user/month. Price = $19/month. **Margin: ~76%**

---

## 14. Release Strategy

### Phase 0: Internal Alpha (Week 1-2)
- Core pipeline working: URL → clone → parse → embed → basic analysis
- No auth, no polish, no edge cases
- Goal: Prove the AI agents produce useful output

### Phase 1: Closed Beta (Week 3-8)
- Full pipeline + auth + chat + dashboard
- Invite 20-50 beta users (developer friends, Twitter followers)
- Collect feedback, iterate on agent prompts, fix bugs
- Goal: Validate that users find value

### Phase 2: Public Beta (Week 9-12)
- Landing page + public sign-up
- Free tier (3 repos/month)
- Product Hunt launch
- Goal: 500 sign-ups, 100 WAU

### Phase 3: General Availability (Week 13-16)
- Pro tier launch ($19/mo)
- PR generation feature
- Production hardening, monitoring, cost optimization
- Goal: First paying customers

### Phase 4: Growth (Week 17+)
- Team tier launch
- Content marketing (blog posts, YouTube demos)
- Integration partnerships (VS Code extension, CI/CD hooks)
- Goal: $1,000 MRR

---

## 15. Open Questions & Decisions

| # | Question | Options | Recommendation | Status |
|---|---------|---------|---------------|--------|
| 1 | **Full-stack Next.js or separate backend?** | A) Next.js Route Handlers + Server Actions for everything. B) Separate Express.js backend for agent workloads. | **B) Hybrid:** Next.js for auth, dashboard, and lightweight APIs. Separate worker process for long-running agent jobs (prevents Vercel function timeout). Both in the same monorepo. | DECIDED |
| 2 | **Monorepo or polyrepo?** | A) Turborepo monorepo. B) Separate repos. | **A) Monorepo** — shared types, single CI, easier refactoring. | DECIDED |
| 3 | **LLM provider lock-in?** | A) OpenAI only. B) Abstract with LangChain for multi-provider. | **B) Abstract with LangChain** — start with OpenAI, but the abstraction is free and future-proofs. | DECIDED |
| 4 | **Self-host vector DB or managed?** | A) pgvector (self-host). B) Pinecone (managed). | **B) Pinecone** — better performance, no operational overhead, free tier for dev. | DECIDED |
| 5 | **How to handle very large repos (>10k files)?** | A) Reject. B) Sample. C) Progressive analysis. | **C) Progressive** — analyze top-level structure first, then let agents decide which modules to deep-dive. | DECIDED |
| 6 | **Should we support non-GitHub repos?** | A) GitHub only (MVP). B) GitHub + GitLab + Bitbucket. | **A) GitHub only for MVP.** Add GitLab/Bitbucket in v2. | DECIDED |
| 7 | **Streaming protocol for chat?** | A) WebSockets (Socket.IO). B) Server-Sent Events (SSE). | **B) SSE** — simpler, works with Next.js API routes, sufficient for unidirectional streaming. Use SSE for agent progress too. | DECIDED |
| 8 | **How to run long-running agent jobs?** | A) Vercel serverless functions (max 5 min on Pro). B) Separate worker process on Railway. C) Inngest / Trigger.dev for durable workflows. | **B) Separate worker on Railway** — full control, no timeout limits, can run BullMQ workers. | DECIDED |

---

*End of PRD*
