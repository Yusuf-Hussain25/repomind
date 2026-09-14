import { getRepo } from "@/lib/store";
import { loadChatHistory, clearChatHistory } from "@/lib/chat-memory";
import { visitorId } from "@/lib/access";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const repo = await getRepo(id);
  if (!repo) return new Response("Not found", { status: 404 });

  const visitor = visitorId(req);
  const messages = await loadChatHistory(repo.id, visitor.id);
  return Response.json(
    { messages },
    visitor.setCookie ? { headers: { "Set-Cookie": visitor.setCookie } } : undefined,
  );
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const repo = await getRepo(id);
  if (!repo) return new Response("Not found", { status: 404 });

  await clearChatHistory(repo.id, visitorId(req).id);
  return Response.json({ ok: true });
}
