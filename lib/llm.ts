import OpenAI from "openai";

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StreamOptions {
  /** Base instruction system prompt. */
  system: string;
  /** Large, reusable context (e.g. the repo). Prepended to the system prompt. */
  context?: string;
  messages: LLMMessage[];
  maxTokens?: number;
}

export interface StreamChunk {
  type: "delta";
  text: string;
}

const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o";

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("No LLM provider configured. Set OPENAI_API_KEY.");
  }
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

export async function* streamLLM(opts: StreamOptions): AsyncGenerator<StreamChunk> {
  const client = getOpenAI();
  const systemContent = opts.context ? `${opts.system}\n\n${opts.context}` : opts.system;
  const stream = await client.chat.completions.create({
    model: OPENAI_MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    stream: true,
    messages: [
      { role: "system", content: systemContent },
      ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield { type: "delta", text: delta };
  }
}
