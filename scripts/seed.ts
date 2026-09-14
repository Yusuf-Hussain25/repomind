// Seed the public demo: create and fully analyze repos directly into the
// Redis in .env.local, so visitors land on ready-to-chat repos.
//
// Usage: npm run seed -- [github urls...]   (defaults to DEFAULT_REPOS)

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { createRepo, listRepos, updateRepo } from "../lib/store";
import { fetchRepoMeta } from "../lib/github";
import { parseGithubUrl } from "../lib/utils";
import { runAnalyzePipeline } from "../lib/analyze";
import { getRedis } from "../lib/redis";
import type { Repo } from "../lib/types";

const DEFAULT_REPOS = [
  "https://github.com/pmndrs/zustand",
  "https://github.com/expressjs/express",
  "https://github.com/encode/httpx",
];

async function seedOne(url: string): Promise<void> {
  const parsed = parseGithubUrl(url);
  if (!parsed) throw new Error(`Invalid GitHub URL: ${url}`);
  const slug = `${parsed.owner}/${parsed.name}`;

  const existing = (await listRepos()).find(
    (r) =>
      r.status === "ready" &&
      r.owner.toLowerCase() === parsed.owner.toLowerCase() &&
      r.name.toLowerCase() === parsed.name.toLowerCase(),
  );
  if (existing) {
    console.log(`skip ${slug} — already analyzed (${existing.id})`);
    return;
  }

  const meta = await fetchRepoMeta(parsed.owner, parsed.name);
  const now = new Date().toISOString();
  const repo: Repo = {
    id: `${parsed.owner}_${parsed.name}_${Date.now().toString(36)}`,
    url: `https://github.com/${slug}`,
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
  console.log(`analyzing ${slug} (${repo.id})`);

  let lastMessage = "";
  try {
    await runAnalyzePipeline({
      repoId: repo.id,
      emit: (event) => {
        if ("stage" in event && event.message && event.message !== lastMessage) {
          lastMessage = event.message;
          console.log(`  [${event.progress}%] ${event.message}`);
        }
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    await updateRepo(repo.id, { status: "error", error: message });
    throw err;
  }
}

async function main(): Promise<number> {
  const urls = process.argv.slice(2);
  let failures = 0;
  for (const url of urls.length > 0 ? urls : DEFAULT_REPOS) {
    try {
      await seedOne(url);
    } catch (err) {
      failures++;
      console.error(`failed ${url}:`, err instanceof Error ? err.message : err);
    }
  }
  return failures === 0 ? 0 : 1;
}

main().then(async (code) => {
  await getRedis().quit();
  process.exit(code);
});
