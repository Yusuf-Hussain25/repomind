// The multi-agent analyzer graph.
//
//                ┌────────────┐
//                │  Planner   │   gpt-4o-mini
//                └─────┬──────┘
//                      ▼
//                ┌────────────┐
//                │  Selector  │   gpt-4o-mini
//                └─────┬──────┘
//             ┌────────┴────────┐
//             ▼                 ▼
//      ┌────────────┐    ┌────────────────┐
//      │ Architect  │    │ ConcernHunter  │   gpt-4o (parallel)
//      └────────┬───┘    └────────┬───────┘
//               └─────┬───────────┘
//                     ▼
//               ┌────────────┐
//               │ Synthesizer│   gpt-4o-mini
//               └────────────┘
//
// Each node streams its tokens out via an `emit` callback and returns a
// partial state update. The top-level analyzer drains the graph and forwards
// `AgentEvent`s to whichever transport the caller cares about (SSE in our
// case).

import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { AGENTS, AgentEvent, AgentName, TokenUsage } from "./types";
import { manifest, parseContextDoc, ParsedFile } from "./parse";
import { streamCompletion, streamCompletionWithTools, parseJsonArray } from "./openai";
import { TOOL_SPECS } from "@/lib/tools";
import {
  ARCHITECT_PROMPT,
  CONCERN_HUNTER_PROMPT,
  FILE_SELECTOR_PROMPT,
  PLANNER_PROMPT,
  SYNTHESIZER_PROMPT,
} from "./prompts";

const sumUsage = (a: TokenUsage, b: TokenUsage): TokenUsage => ({
  input: a.input + b.input,
  output: a.output + b.output,
});

const State = Annotation.Root({
  repoId: Annotation<string>(),
  repoUrl: Annotation<string>(),
  contextDoc: Annotation<string>(),
  files: Annotation<ParsedFile[]>(),
  plan: Annotation<string>({ reducer: (_, b) => b ?? "", default: () => "" }),
  selectedFiles: Annotation<string[]>({ reducer: (_, b) => b ?? [], default: () => [] }),
  architectureSection: Annotation<string>({ reducer: (_, b) => b ?? "", default: () => "" }),
  concernsSection: Annotation<string>({ reducer: (_, b) => b ?? "", default: () => "" }),
  finalReport: Annotation<string>({ reducer: (_, b) => b ?? "", default: () => "" }),
  totalUsage: Annotation<TokenUsage>({
    reducer: sumUsage,
    default: () => ({ input: 0, output: 0 }),
  }),
});

type StateT = typeof State.State;

type Emit = (e: AgentEvent) => void;

function withTiming(agent: AgentName, emit: Emit) {
  const t0 = Date.now();
  emit({ type: "agent_start", agent, ts: t0 });
  return (usage: TokenUsage) =>
    emit({ type: "agent_done", agent, ts: Date.now(), usage, durationMs: Date.now() - t0 });
}

// ── Nodes ────────────────────────────────────────────────────────────────────

function plannerNode(emit: Emit) {
  return async (state: StateT): Promise<Partial<StateT>> => {
    const finish = withTiming("planner", emit);
    const { text, usage } = await streamCompletion({
      model: AGENTS.planner.model,
      maxTokens: 300,
      messages: [
        { role: "system", content: PLANNER_PROMPT },
        {
          role: "user",
          content: `Repo: ${state.repoUrl}\n\nFile manifest:\n${manifest(state.files)}`,
        },
      ],
      onDelta: (text) => emit({ type: "agent_token", agent: "planner", text }),
    });
    finish(usage);
    return { plan: text, totalUsage: usage };
  };
}

function fileSelectorNode(emit: Emit) {
  return async (state: StateT): Promise<Partial<StateT>> => {
    const finish = withTiming("file_selector", emit);
    const { text, usage } = await streamCompletion({
      model: AGENTS.file_selector.model,
      maxTokens: 800,
      messages: [
        { role: "system", content: FILE_SELECTOR_PROMPT },
        {
          role: "user",
          content: `Planner strategy:\n${state.plan}\n\nFile manifest:\n${manifest(state.files)}`,
        },
      ],
      onDelta: (text) => emit({ type: "agent_token", agent: "file_selector", text }),
    });
    let picks = parseJsonArray(text);
    // Sanity: keep only paths that actually exist.
    const existing = new Set(state.files.map((f) => f.path));
    picks = picks.filter((p) => existing.has(p)).slice(0, 22);
    if (picks.length === 0) {
      // Fallback: take the top 15 by the manifest's natural order (already
      // ranked by importance in github.ts).
      picks = state.files.slice(0, 15).map((f) => f.path);
    }
    finish(usage);
    return { selectedFiles: picks, totalUsage: usage };
  };
}

function architectNode(emit: Emit) {
  return async (state: StateT): Promise<Partial<StateT>> => {
    const finish = withTiming("architect", emit);
    const userMessage =
      `Repo: ${state.repoUrl}\n\n` +
      `Planner strategy:\n${state.plan}\n\n` +
      `FileSelector shortlist (use read_file to inspect what you need):\n${state.selectedFiles.join("\n")}\n\n` +
      `Full file manifest (paths + sizes):\n${manifest(state.files)}`;
    const { text, usage } = await streamCompletionWithTools({
      model: AGENTS.architect.model,
      maxTokens: 2500,
      tools: TOOL_SPECS,
      toolContext: { repoId: state.repoId, files: state.files },
      agent: "architect",
      messages: [
        { role: "system", content: ARCHITECT_PROMPT },
        { role: "user", content: userMessage },
      ],
      onDelta: (text) => emit({ type: "agent_token", agent: "architect", text }),
      emit,
    });
    finish(usage);
    return { architectureSection: text, totalUsage: usage };
  };
}

function concernHunterNode(emit: Emit) {
  return async (state: StateT): Promise<Partial<StateT>> => {
    const finish = withTiming("concern_hunter", emit);
    const userMessage =
      `Repo: ${state.repoUrl}\n\n` +
      `Planner strategy:\n${state.plan}\n\n` +
      `FileSelector shortlist (use read_file/grep to investigate):\n${state.selectedFiles.join("\n")}\n\n` +
      `Full file manifest (paths + sizes):\n${manifest(state.files)}`;
    const { text, usage } = await streamCompletionWithTools({
      model: AGENTS.concern_hunter.model,
      maxTokens: 1500,
      tools: TOOL_SPECS,
      toolContext: { repoId: state.repoId, files: state.files },
      agent: "concern_hunter",
      messages: [
        { role: "system", content: CONCERN_HUNTER_PROMPT },
        { role: "user", content: userMessage },
      ],
      onDelta: (text) => emit({ type: "agent_token", agent: "concern_hunter", text }),
      emit,
    });
    finish(usage);
    return { concernsSection: text, totalUsage: usage };
  };
}

function synthesizerNode(emit: Emit) {
  return async (state: StateT): Promise<Partial<StateT>> => {
    const finish = withTiming("synthesizer", emit);
    const drafts = `Architect's sections:\n\n${state.architectureSection}\n\n---\n\nConcernHunter's section:\n\n${state.concernsSection}`;
    const { text, usage } = await streamCompletion({
      model: AGENTS.synthesizer.model,
      maxTokens: 3500,
      messages: [
        { role: "system", content: SYNTHESIZER_PROMPT },
        { role: "user", content: `Repo: ${state.repoUrl}\n\n${drafts}` },
      ],
      onDelta: (text) => emit({ type: "agent_token", agent: "synthesizer", text }),
    });
    finish(usage);
    return { finalReport: text, totalUsage: usage };
  };
}

// ── Graph build & run ────────────────────────────────────────────────────────

export function buildAnalyzerGraph(emit: Emit) {
  const graph = new StateGraph(State)
    .addNode("planner", plannerNode(emit))
    .addNode("file_selector", fileSelectorNode(emit))
    .addNode("architect", architectNode(emit))
    .addNode("concern_hunter", concernHunterNode(emit))
    .addNode("synthesizer", synthesizerNode(emit))
    .addEdge(START, "planner")
    .addEdge("planner", "file_selector")
    // Architect and ConcernHunter both fan out from FileSelector;
    // LangGraph runs them concurrently because they share a parent.
    .addEdge("file_selector", "architect")
    .addEdge("file_selector", "concern_hunter")
    .addEdge("architect", "synthesizer")
    .addEdge("concern_hunter", "synthesizer")
    .addEdge("synthesizer", END);
  return graph.compile();
}

export interface RunAnalyzerOptions {
  repoId: string;
  repoUrl: string;
  contextDoc: string;
  emit: Emit;
}

export async function runAnalyzer(opts: RunAnalyzerOptions): Promise<{
  finalReport: string;
  totalUsage: TokenUsage;
}> {
  const files = parseContextDoc(opts.contextDoc);
  if (files.length === 0) throw new Error("Context document contained no parseable files.");

  opts.emit({ type: "graph_start", ts: Date.now() });
  const app = buildAnalyzerGraph(opts.emit);
  const final = (await app.invoke({
    repoId: opts.repoId,
    repoUrl: opts.repoUrl,
    contextDoc: opts.contextDoc,
    files,
  })) as StateT;
  opts.emit({
    type: "graph_done",
    ts: Date.now(),
    finalReport: final.finalReport,
    totalUsage: final.totalUsage,
  });
  return { finalReport: final.finalReport, totalUsage: final.totalUsage };
}
