import { NextResponse } from "next/server";
import { getRepo } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const repo = await getRepo(id);
  if (!repo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ repo });
}
