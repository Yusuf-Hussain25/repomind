// Thin wrapper around the OpenAI streaming chat API for use inside agent nodes.
// Yields delta text via a callback, returns the full text + token usage.
//
// Token usage is requested via `stream_options: { include_usage: true }` —
// OpenAI sends a final chunk with the usage block when streaming.

import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import type { AgentEvent, AgentName, TokenUsage } from "./types";
import { executeTool, type ToolContext } from "@/lib/tools";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamCompletionOptions {
  model: string;
  messages: ChatMessage[];
  maxTokens: number;
  temperature?: number;
  /** Called for every text delta. */
  onDelta?: (text: string) => void;
}

export interface CompletionResult {
  text: string;
  usage: TokenUsage;
}

export async function streamCompletion(opts: StreamCompletionOptions): Promise<CompletionResult> {
  const client = getClient();
  const stream = await client.chat.completions.create({
    model: opts.model,
    max_tokens: opts.maxTokens,
    temperature: opts.temperature ?? 0.2,
    stream: true,
    stream_options: { include_usage: true },
    messages: opts.messages,
  });

  let text = "";
  let usage: TokenUsage = { input: 0, output: 0 };

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      text += delta;
      opts.onDelta?.(delta);
    }
    // The final chunk in a streamed response carries the usage object.
    if (chunk.usage) {
      usage = {
        input: chunk.usage.prompt_tokens ?? 0,
        output: chunk.usage.completion_tokens ?? 0,
      };
    }
  }

  return { text, usage };
}

// ── Tool-using completion ────────────────────────────────────────────────────
//
// streamCompletionWithTools drives an OpenAI function-calling loop:
//   1. Stream a completion with `tools: [...]` available.
//   2. If the model returns tool_calls, execute them via lib/tools, append
//      tool result messages, and continue streaming.
//   3. Otherwise return the assistant text.
// Tool invocations and results are emitted as AgentEvents so the UI can
// render them as cards. Capped at MAX_ITERATIONS to prevent runaway loops.

const MAX_ITERATIONS = 5;

export interface ToolLoopOptions {
  model: string;
  messages: ChatCompletionMessageParam[];
  maxTokens: number;
  temperature?: number;
  tools: ChatCompletionTool[];
  toolContext: ToolContext;
  agent: AgentName;
  onDelta?: (text: string) => void;
  emit?: (e: AgentEvent) => void;
  maxIterations?: number;
}

interface InflightToolCall {
  id: string;
  name: string;
  argsJson: string;
}

export async function streamCompletionWithTools(
  opts: ToolLoopOptions,
): Promise<CompletionResult> {
  const client = getClient();
  const messages: ChatCompletionMessageParam[] = [...opts.messages];
  const totalUsage: TokenUsage = { input: 0, output: 0 };
  const maxIterations = opts.maxIterations ?? MAX_ITERATIONS;

  let finalText = "";

  for (let iter = 0; iter < maxIterations; iter++) {
    const stream = await client.chat.completions.create({
      model: opts.model,
      max_tokens: opts.maxTokens,
      temperature: opts.temperature ?? 0.2,
      stream: true,
      stream_options: { include_usage: true },
      messages,
      tools: opts.tools,
    });

    let text = "";
    const inflight = new Map<number, InflightToolCall>();
    let finishReason: string | null = null;

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      const delta = choice?.delta;
      if (delta?.content) {
        text += delta.content;
        opts.onDelta?.(delta.content);
      }
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          const existing = inflight.get(idx) ?? { id: "", name: "", argsJson: "" };
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.name = tc.function.name;
          if (tc.function?.arguments) existing.argsJson += tc.function.arguments;
          inflight.set(idx, existing);
        }
      }
      if (choice?.finish_reason) {
        finishReason = choice.finish_reason;
      }
      if (chunk.usage) {
        totalUsage.input += chunk.usage.prompt_tokens ?? 0;
        totalUsage.output += chunk.usage.completion_tokens ?? 0;
      }
    }

    finalText = text;

    if (finishReason !== "tool_calls" || inflight.size === 0) {
      // Model is done — no further tool round-trips needed.
      return { text: finalText, usage: totalUsage };
    }

    // Persist the assistant turn (with its tool_calls) before injecting
    // tool result messages.
    const assistantToolCalls = Array.from(inflight.values()).map((tc) => ({
      id: tc.id,
      type: "function" as const,
      function: { name: tc.name, arguments: tc.argsJson || "{}" },
    }));
    messages.push({
      role: "assistant",
      content: text || null,
      tool_calls: assistantToolCalls,
    });

    // Execute each tool call sequentially, emit events, append results.
    for (const call of assistantToolCalls) {
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = call.function.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        // Fall through with empty args — executeTool will surface the error.
      }
      const tStart = Date.now();
      opts.emit?.({
        type: "tool_call",
        agent: opts.agent,
        toolCallId: call.id,
        tool: call.function.name,
        args: parsedArgs,
        ts: tStart,
      });
      const result = await executeTool(call.function.name, parsedArgs, opts.toolContext);
      opts.emit?.({
        type: "tool_result",
        agent: opts.agent,
        toolCallId: call.id,
        tool: call.function.name,
        preview: result.preview,
        ok: result.ok,
        ts: Date.now(),
        durationMs: Date.now() - tStart,
      });
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: result.content,
      });
    }
    // Loop continues — model will see the tool results on the next pass.
  }

  // Hit iteration cap — return whatever we have.
  return { text: finalText, usage: totalUsage };
}

/** Strip code fences / commentary from a JSON-array response. Robust to
 *  models that ignore the "no code fence" instruction. */
export function parseJsonArray(raw: string): string[] {
  let s = raw.trim();
  // Strip ```json ... ```
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```$/m, "").trim();
  // Find the first [ and the last ]
  const open = s.indexOf("[");
  const close = s.lastIndexOf("]");
  if (open === -1 || close === -1) return [];
  try {
    const arr = JSON.parse(s.slice(open, close + 1));
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
