import { NextRequest, NextResponse } from "next/server";
import { createRepo, listRepos } from "@/lib/store";
import { fetchRepoMeta } from "@/lib/github";
import { parseGithubUrl } from "@/lib/utils";
import type { Repo } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const repos = await listRepos();
  return NextResponse.json({ repos });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.url !== "string") {
    return NextResponse.json({ error: "Provide a GitHub repository URL" }, { status: 400 });
  }
  const parsed = parseGithubUrl(body.url);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid GitHub URL. Expected https://github.com/owner/repo" }, { status: 400 });
  }

  let meta;
  try {
    meta = await fetchRepoMeta(parsed.owner, parsed.name);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reach GitHub";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const id = `${parsed.owner}_${parsed.name}_${Date.now().toString(36)}`;
  const now = new Date().toISOString();
  const repo: Repo = {
    id,
    url: `https://github.com/${parsed.owner}/${parsed.name}`,
    owner: parsed.owner,
    name: parsed.name,
    defaultBranch: meta.defaultBranch,
    status: "pending",
    description: meta.description,
    language: meta.language,
    stars: meta.stars,
    createdAt: now,
    updatedAt: now,
  };
  await createRepo(repo);
  return NextResponse.json({ repo });
}
