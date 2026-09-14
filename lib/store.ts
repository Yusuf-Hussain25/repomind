import { promises as fs } from "fs";
import path from "path";
import type { Repo } from "./types";

const DATA_DIR = path.join(process.cwd(), ".data");
const REPOS_FILE = path.join(DATA_DIR, "repos.json");
const FILES_DIR = path.join(DATA_DIR, "files");

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(FILES_DIR, { recursive: true });
}

async function readAll(): Promise<Repo[]> {
  await ensureDir();
  try {
    const raw = await fs.readFile(REPOS_FILE, "utf-8");
    return JSON.parse(raw) as Repo[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function writeAll(repos: Repo[]): Promise<void> {
  await ensureDir();
  await fs.writeFile(REPOS_FILE, JSON.stringify(repos, null, 2), "utf-8");
}

export async function listRepos(): Promise<Repo[]> {
  const repos = await readAll();
  return repos.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getRepo(id: string): Promise<Repo | null> {
  const repos = await readAll();
  return repos.find((r) => r.id === id) ?? null;
}

export async function createRepo(repo: Repo): Promise<void> {
  const repos = await readAll();
  if (repos.some((r) => r.id === repo.id)) return;
  repos.push(repo);
  await writeAll(repos);
}

export async function updateRepo(id: string, patch: Partial<Repo>): Promise<Repo | null> {
  const repos = await readAll();
  const idx = repos.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const merged: Repo = { ...repos[idx], ...patch, updatedAt: new Date().toISOString() };
  repos[idx] = merged;
  await writeAll(repos);
  return merged;
}

export async function saveContext(id: string, context: string): Promise<void> {
  await ensureDir();
  await fs.writeFile(path.join(FILES_DIR, `${id}.txt`), context, "utf-8");
}

export async function loadContext(id: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(FILES_DIR, `${id}.txt`), "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}
