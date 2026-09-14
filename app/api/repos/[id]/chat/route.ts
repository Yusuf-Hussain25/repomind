import { getRepo, loadContext } from "@/lib/store";
import { CHAT_AGENT_SYSTEM } from "@/lib/prompts";
import { parseContextDoc } from "@/lib/agents/parse";
import { streamCompletionWithTools } from "@/lib/agents/openai";
import { TOOL_SPECS } from "@/lib/tools";
import { appendChatTurn } from "@/lib/chat-memory";
import { clientIp, hasAccess, visitorId } from "@/lib/access";
import { envInt, hitLimit } from "@/lib/ratelimit";
import type { ChatMessage } from "@/lib/types";
import type { AgentEvent } from "@/lib/agents/types";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export const runtime = "nodejs";
export const maxDuration = 300;

// Bounds on what a client can make us send to the model.
const MAX_HISTORY = 12;
const MAX_MESSAGE_CHARS = 4000;

interface DeltaEvent {
  type: "delta";
  text: string;
}

interface DoneEvent {
  type: "done";
}

interface ErrorEvent {
  type: "error";
  message: string;
}

export type ChatEvent = DeltaEvent | DoneEvent | ErrorEvent | AgentEvent;

function isChatMessage(m: unknown): m is ChatMessage {
  if (!m || typeof m !== "object") return false;
  const { role, content } = m as ChatMessage;
  return (role === "user" || role === "assistant") && typeof content === "string";
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const repo = await getRepo(id);
  if (!repo) return new Response("Not found", { status: 404 });

  const body = await req.json().catch(() => null);
  const history: ChatMessage[] = (Array.isArray(body?.messages) ? body.messages : [])
    .filter(isChatMessage)
    .slice(-MAX_HISTORY)
    .map((m: ChatMessage) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return new Response("Last message must be from the user", { status: 400 });
  }

  const contextDoc = await loadContext(repo.id);
  if (!contextDoc) {
    return new Response("Repository not yet indexed. Run analysis first.", { status: 400 });
  }

  // Public demo: every turn spends OpenAI credit, so anonymous visitors get
  // a per-IP hourly allowance and all of them share one daily cap.
  const isOwner = hasAccess(req);
  if (!isOwner) {
    const perHour = envInt("CHAT_LIMIT_PER_HOUR", 15);
    const ipLimit = await hitLimit(`chat:ip:${clientIp(req)}`, perHour, 60 * 60);
    if (!ipLimit.ok) {
      const minutes = Math.ceil(ipLimit.retryAfterSec / 60);
      return new Response(
        `Demo limit reached (${perHour} questions per hour). Try again in ${minutes} min.`,
        { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSec) } },
      );
    }
    const today = new Date().toISOString().slice(0, 10);
    const dailyLimit = await hitLimit(
      `chat:day:${today}`,
      envInt("CHAT_LIMIT_PER_DAY", 300),
      60 * 60 * 24,
    );
    if (!dailyLimit.ok) {
      return new Response(
        "The public demo has used today's budget. Please come back tomorrow.",
        { status: 429 },
      );
    }
  }

  const visitor = visitorId(req);

  // Parse the indexed context once so the file tools (read_file / grep /
  // list_directory) have something to operate on without re-fetching from
  // GitHub. search_code uses Pinecone separately.
  const parsedFiles = parseContextDoc(contextDoc);

  // Compact orientation block: file paths + sizes only. Lets the model
  // decide which tools to call without us pre-stuffing file bodies.
  const manifest = parsedFiles
    .map((f) => `${f.path}\t${f.body.length} chars`)
    .join("\n");
  const systemContent =
    `${CHAT_AGENT_SYSTEM}\n\n## Repo: ${repo.owner}/${repo.name}\n\n` +
    `## File manifest (${parsedFiles.length} files)\n\n${manifest}`;

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemContent },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  // Persist the user turn immediately so chat memory survives a refresh
  // even if the assistant errors out mid-stream.
  const userTurn = history[history.length - 1];
  await appendChatTurn(repo.id, visitor.id, userTurn);

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (chunk: ChatEvent) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        } catch {
          // controller already closed
        }
      };

      let assistantText = "";
      try {
        await streamCompletionWithTools({
          model: process.env.OPENAI_MODEL ?? "gpt-4o",
          messages,
          maxTokens: isOwner ? 4000 : 1500,
          tools: TOOL_SPECS,
          toolContext: { repoId: repo.id, files: parsedFiles },
          agent: "chat",
          onDelta: (text) => {
            assistantText += text;
            send({ type: "delta", text });
          },
          emit: (event) => send(event),
        });
        if (assistantText.trim()) {
          await appendChatTurn(repo.id, visitor.id, { role: "assistant", content: assistantText });
        }
        send({ type: "done" });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Chat failed";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  const headers: Record<string, string> = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };
  if (visitor.setCookie) headers["Set-Cookie"] = visitor.setCookie;

  return new Response(stream, { headers });
}
