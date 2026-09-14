import { getRepo, loadContext } from "@/lib/store";
import { CHAT_AGENT_SYSTEM } from "@/lib/prompts";
import { parseContextDoc } from "@/lib/agents/parse";
import { streamCompletionWithTools } from "@/lib/agents/openai";
import { TOOL_SPECS } from "@/lib/tools";
import { appendChatTurn } from "@/lib/chat-memory";
import type { ChatMessage } from "@/lib/types";
import type { AgentEvent } from "@/lib/agents/types";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export const runtime = "nodejs";
export const maxDuration = 300;

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

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const repo = await getRepo(id);
  if (!repo) return new Response("Not found", { status: 404 });

  const body = await req.json().catch(() => null);
  const history: ChatMessage[] = Array.isArray(body?.messages) ? body.messages : [];
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return new Response("Last message must be from the user", { status: 400 });
  }

  const contextDoc = await loadContext(repo.id);
  if (!contextDoc) {
    return new Response("Repository not yet indexed. Run analysis first.", { status: 400 });
  }

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
  await appendChatTurn(repo.id, userTurn);

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
          maxTokens: 4000,
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
          await appendChatTurn(repo.id, { role: "assistant", content: assistantText });
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

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
