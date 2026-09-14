// Shared types for the multi-agent analyzer.
//
// The graph is: Planner → FileSelector → (Architect ‖ ConcernHunter) → Synthesizer.
// Nodes communicate via a single shared state object (LangGraph convention).

export type AgentName =
  | "planner"
  | "file_selector"
  | "architect"
  | "concern_hunter"
  | "synthesizer"
  | "chat";

export type AgentStatus = "pending" | "running" | "done" | "error";

export interface AgentMeta {
  name: AgentName;
  label: string;
  /** UI accent color (Tailwind-friendly hex) */
  hue: string;
  /** Underlying OpenAI model used by this node. */
  model: string;
  /** Short one-liner shown in the UI. */
  blurb: string;
}

export const AGENTS: Record<AgentName, AgentMeta> = {
  planner: {
    name: "planner",
    label: "Planner",
    hue: "#a371f7",
    model: "gpt-4o-mini",
    blurb: "Reads the file manifest and decides the analysis strategy.",
  },
  file_selector: {
    name: "file_selector",
    label: "File Selector",
    hue: "#79b8ff",
    model: "gpt-4o-mini",
    blurb: "Picks the 15–20 most architecturally important files.",
  },
  architect: {
    name: "architect",
    label: "Architect",
    hue: "#56d364",
    model: "gpt-4o",
    blurb: "Maps the architecture, modules, and entry points.",
  },
  concern_hunter: {
    name: "concern_hunter",
    label: "Concern Hunter",
    hue: "#f78166",
    model: "gpt-4o",
    blurb: "Surfaces bugs, security risks, and code smells.",
  },
  synthesizer: {
    name: "synthesizer",
    label: "Synthesizer",
    hue: "#ffa657",
    model: "gpt-4o-mini",
    blurb: "Assembles the final report and getting-started section.",
  },
  chat: {
    name: "chat",
    label: "Chat",
    hue: "#79b8ff",
    model: "gpt-4o",
    blurb: "Tool-using Q&A agent — calls search_code/read_file/grep on demand.",
  },
};

export const AGENT_ORDER: AgentName[] = [
  "planner",
  "file_selector",
  "architect",
  "concern_hunter",
  "synthesizer",
];

export interface TokenUsage {
  input: number;
  output: number;
}

/** What an agent emits while it runs. Streamed to the client over SSE. */
export type AgentEvent =
  | { type: "agent_start"; agent: AgentName; ts: number }
  | { type: "agent_token"; agent: AgentName; text: string }
  | { type: "agent_done"; agent: AgentName; ts: number; usage?: TokenUsage; durationMs: number }
  | { type: "agent_error"; agent: AgentName; message: string }
  | {
      type: "tool_call";
      agent: AgentName;
      toolCallId: string;
      tool: string;
      args: Record<string, unknown>;
      ts: number;
    }
  | {
      type: "tool_result";
      agent: AgentName;
      toolCallId: string;
      tool: string;
      preview: string;
      ok: boolean;
      ts: number;
      durationMs: number;
    }
  | { type: "graph_start"; ts: number }
  | { type: "graph_done"; ts: number; finalReport: string; totalUsage: TokenUsage }
  | { type: "graph_error"; message: string };

export interface FileEntry {
  path: string;
  size: number;
}
