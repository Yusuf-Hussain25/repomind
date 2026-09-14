// Seed the public demo: create and fully analyze repos directly into the
// Redis in .env.local, so visitors land on ready-to-chat repos. Prints the
// token usage and estimated OpenAI cost of each analysis.
//
// Usage: npm run seed -- [github urls...]   (defaults to DEFAULT_REPOS)

import "../lib/load-env";
import { createRepo, listRepos, updateRepo } from "../lib/store";
import { fetchRepoMeta } from "../lib/github";
import { parseGithubUrl } from "../lib/utils";
import { runAnalyzePipeline } from "../lib/analyze";
import { getRedis } from "../lib/redis";
import { AGENTS } from "../lib/agents/types";
import type { Repo } from "../lib/types";

const DEFAULT_REPOS = [
  "https://github.com/pmndrs/zustand",
  "https://github.com/expressjs/express",
  "https://github.com/encode/httpx",
];

// USD per 1M tokens. Estimate only; embeddings (text-embedding-3-small,
// $0.02/1M) aren't included because the embed step doesn't report tokens.
const PRICING: Record<string, { in: number; out: number }> = {
  "gpt-4o": { in: 2.5, out: 10 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
};

interface SeedResult {
  slug: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  seconds: number;
}

async function seedOne(url: string): Promise<SeedResult | null> {
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
    return null;
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

  const result: SeedResult = { slug, inputTokens: 0, outputTokens: 0, costUsd: 0, seconds: 0 };
  const startedAt = Date.now();
  let lastMessage = "";
  try {
    await runAnalyzePipeline({
      repoId: repo.id,
      emit: (event) => {
        if ("stage" in event) {
          if (event.message && event.message !== lastMessage) {
            lastMessage = event.message;
            console.log(`  [${event.progress}%] ${event.message}`);
          }
          return;
        }
        if (event.type === "agent_done" && event.usage) {
          const price = PRICING[AGENTS[event.agent].model] ?? PRICING["gpt-4o"];
          result.inputTokens += event.usage.input;
          result.outputTokens += event.usage.output;
          result.costUsd +=
            (event.usage.input * price.in + event.usage.output * price.out) / 1_000_000;
        }
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    await updateRepo(repo.id, { status: "error", error: message });
    throw err;
  }
  result.seconds = Math.round((Date.now() - startedAt) / 1000);
  return result;
}

async function main(): Promise<number> {
  const urls = process.argv.slice(2);
  const results: SeedResult[] = [];
  let failures = 0;
  for (const url of urls.length > 0 ? urls : DEFAULT_REPOS) {
    try {
      const result = await seedOne(url);
      if (result) results.push(result);
    } catch (err) {
      failures++;
      console.error(`failed ${url}:`, err instanceof Error ? err.message : err);
    }
  }

  if (results.length > 0) {
    console.log("\nrepo | input tokens | output tokens | est. cost | time");
    for (const r of results) {
      console.log(
        `${r.slug} | ${r.inputTokens} | ${r.outputTokens} | $${r.costUsd.toFixed(4)} | ${r.seconds}s`,
      );
    }
    const total = results.reduce((sum, r) => sum + r.costUsd, 0);
    console.log(`total est. cost: $${total.toFixed(4)}`);
  }
  return failures === 0 ? 0 : 1;
}

main().then(async (code) => {
  await getRedis().quit();
  process.exit(code);
});
