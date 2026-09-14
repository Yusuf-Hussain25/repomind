import type { RepoFile } from "./types";

const GH_API = "https://api.github.com";

const TEXT_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs",
  "py", "rb", "go", "rs", "java", "kt", "scala", "swift",
  "c", "cc", "cpp", "h", "hpp", "cs",
  "php", "sh", "bash", "zsh",
  "json", "yaml", "yml", "toml", "xml", "ini", "env",
  "md", "mdx", "rst", "txt",
  "html", "css", "scss", "sass", "less", "vue", "svelte",
  "sql", "prisma", "graphql", "proto",
  "dockerfile", "gitignore", "lock",
]);

const PRIORITY_FILES = new Set([
  "README.md", "readme.md", "README", "Readme.md",
  "package.json", "tsconfig.json", "next.config.ts", "next.config.js",
  "pyproject.toml", "requirements.txt", "Pipfile", "setup.py",
  "go.mod", "Cargo.toml", "Gemfile", "pom.xml", "build.gradle",
  "Dockerfile", "docker-compose.yml", "Makefile",
  "AGENTS.md", "CLAUDE.md", "CONTRIBUTING.md", "ARCHITECTURE.md",
]);

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", "out",
  "vendor", "target", ".venv", "venv", "__pycache__", ".pytest_cache",
  "coverage", ".nuxt", ".cache", ".turbo", ".vercel",
]);

export interface RepoMeta {
  defaultBranch: string;
  description: string | null;
  language: string | null;
  stars: number;
  size: number;
}

interface TreeEntry {
  path: string;
  type: "blob" | "tree";
  size?: number;
  sha: string;
}

function ghHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "repoinsight-mvp",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

export async function fetchRepoMeta(owner: string, name: string): Promise<RepoMeta> {
  const res = await fetch(`${GH_API}/repos/${owner}/${name}`, { headers: ghHeaders(), cache: "no-store" });
  if (!res.ok) {
    if (res.status === 404) throw new Error("Repository not found or private");
    if (res.status === 403) throw new Error("GitHub API rate limit reached. Set GITHUB_TOKEN to increase the limit.");
    throw new Error(`GitHub API error ${res.status}`);
  }
  const data = await res.json();
  return {
    defaultBranch: data.default_branch ?? "main",
    description: data.description ?? null,
    language: data.language ?? null,
    stars: data.stargazers_count ?? 0,
    size: data.size ?? 0,
  };
}

export async function fetchRepoTree(owner: string, name: string, branch: string): Promise<TreeEntry[]> {
  const res = await fetch(
    `${GH_API}/repos/${owner}/${name}/git/trees/${branch}?recursive=1`,
    { headers: ghHeaders(), cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Failed to fetch repo tree (${res.status})`);
  const data = await res.json();
  return (data.tree as TreeEntry[]) ?? [];
}

function isInterestingPath(path: string): boolean {
  const segments = path.split("/");
  if (segments.some((seg) => SKIP_DIRS.has(seg))) return false;
  const base = segments[segments.length - 1];
  if (PRIORITY_FILES.has(base)) return true;
  const ext = base.includes(".") ? base.split(".").pop()!.toLowerCase() : base.toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

function rankPath(path: string): number {
  const base = path.split("/").pop() ?? "";
  if (PRIORITY_FILES.has(base)) return 0;
  const depth = path.split("/").length;
  let score = depth * 10;
  if (/(^|\/)src\//.test(path)) score -= 5;
  if (/(^|\/)app\//.test(path)) score -= 5;
  if (/(^|\/)lib\//.test(path)) score -= 4;
  if (/index\.(ts|tsx|js)$/.test(path)) score -= 3;
  if (/\.test\.|\.spec\./.test(path)) score += 8;
  return score;
}

export interface FetchFilesOptions {
  maxFiles?: number;
  maxBytesPerFile?: number;
  maxTotalBytes?: number;
  onProgress?: (loaded: number, target: number) => void;
}

export async function fetchRepoFiles(
  owner: string,
  name: string,
  branch: string,
  opts: FetchFilesOptions = {},
): Promise<{ files: RepoFile[]; totalBytes: number; skipped: number }> {
  const maxFiles = opts.maxFiles ?? 60;
  const maxBytesPerFile = opts.maxBytesPerFile ?? 60_000;
  const maxTotalBytes = opts.maxTotalBytes ?? 600_000;

  const tree = await fetchRepoTree(owner, name, branch);
  const blobs = tree
    .filter((e) => e.type === "blob")
    .filter((e) => isInterestingPath(e.path))
    .filter((e) => (e.size ?? 0) <= maxBytesPerFile)
    .sort((a, b) => rankPath(a.path) - rankPath(b.path))
    .slice(0, maxFiles);

  const files: RepoFile[] = [];
  let totalBytes = 0;
  let skipped = 0;

  for (let i = 0; i < blobs.length; i++) {
    const blob = blobs[i];
    if (totalBytes + (blob.size ?? 0) > maxTotalBytes) {
      skipped++;
      continue;
    }
    const url = `https://raw.githubusercontent.com/${owner}/${name}/${branch}/${blob.path}`;
    const res = await fetch(url, { headers: ghHeaders(), cache: "no-store" });
    if (!res.ok) {
      skipped++;
      continue;
    }
    const content = await res.text();
    const trimmed = content.length > maxBytesPerFile ? content.slice(0, maxBytesPerFile) + "\n... [truncated]" : content;
    files.push({ path: blob.path, content: trimmed, size: trimmed.length });
    totalBytes += trimmed.length;
    opts.onProgress?.(i + 1, blobs.length);
  }

  return { files, totalBytes, skipped };
}

export function buildContextDocument(repoUrl: string, files: RepoFile[]): string {
  const header = `# Repository: ${repoUrl}\n\nFiles indexed: ${files.length}\n\n---\n`;
  const body = files
    .map((f) => `\n## File: ${f.path}\n\n\`\`\`\n${f.content}\n\`\`\`\n`)
    .join("");
  return header + body;
}
