// Repo metadata and indexed file dumps, stored in Redis.
//
// Redis (not the local filesystem) so the app runs on serverless hosts,
// where the disk is read-only and not shared between invocations.
//
//   repo:<id>      JSON-encoded Repo
//   repos:index    sorted set of repo ids, scored by createdAt
//   context:<id>   the indexed context document for chat + agents

import { getRedis } from "./redis";
import type { Repo } from "./types";

const INDEX_KEY = "repos:index";
const repoKey = (id: string) => `repo:${id}`;
const contextKey = (id: string) => `context:${id}`;

function parseRepo(raw: string | null): Repo | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Repo;
  } catch {
    return null;
  }
}

export async function listRepos(): Promise<Repo[]> {
  const r = getRedis();
  const ids = await r.zrevrange(INDEX_KEY, 0, -1);
  if (ids.length === 0) return [];
  const raw = await r.mget(...ids.map(repoKey));
  return raw.map(parseRepo).filter((repo): repo is Repo => repo !== null);
}

export async function getRepo(id: string): Promise<Repo | null> {
  return parseRepo(await getRedis().get(repoKey(id)));
}

export async function createRepo(repo: Repo): Promise<void> {
  const r = getRedis();
  const created = await r.set(repoKey(repo.id), JSON.stringify(repo), "NX");
  if (created) {
    await r.zadd(INDEX_KEY, Date.parse(repo.createdAt), repo.id);
  }
}

export async function updateRepo(id: string, patch: Partial<Repo>): Promise<Repo | null> {
  const r = getRedis();
  const current = parseRepo(await r.get(repoKey(id)));
  if (!current) return null;
  const merged: Repo = { ...current, ...patch, updatedAt: new Date().toISOString() };
  await r.set(repoKey(id), JSON.stringify(merged));
  return merged;
}

export async function saveContext(id: string, context: string): Promise<void> {
  await getRedis().set(contextKey(id), context);
}

export async function loadContext(id: string): Promise<string | null> {
  return getRedis().get(contextKey(id));
}
