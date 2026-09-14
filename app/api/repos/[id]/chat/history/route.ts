import { getRepo } from "@/lib/store";
import { loadChatHistory, clearChatHistory } from "@/lib/chat-memory";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const repo = await getRepo(id);
  if (!repo) return new Response("Not found", { status: 404 });

  const messages = await loadChatHistory(repo.id);
  return Response.json({ messages });
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const repo = await getRepo(id);
  if (!repo) return new Response("Not found", { status: 404 });

  await clearChatHistory(repo.id);
  return Response.json({ ok: true });
}
