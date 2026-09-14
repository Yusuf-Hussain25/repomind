// RAG pipeline: chunk repo files → embed → upsert to Pinecone (namespace per
// repo) → retrieve top-K for chat. Phase 1 of the roadmap.
//
// Embedding model: text-embedding-3-small (1536 dims, $0.02 / 1M tokens).
// Pinecone index is serverless, auto-created on first use if missing.

import { Pinecone, type Index } from "@pinecone-database/pinecone";
import OpenAI from "openai";
import type { ParsedFile } from "./agents/parse";

const EMBED_MODEL = "text-embedding-3-small";
const EMBED_DIM = 1536;
// ~800 tokens, 100 token overlap. Char count is a 4×-tokens approximation
// that holds well enough for code.
const CHUNK_CHARS = 3200;
const CHUNK_OVERLAP = 400;
// OpenAI embeddings API caps a single batch at 2048 inputs / 300k tokens.
// 96 keeps us well under both for code-sized chunks.
const EMBED_BATCH = 96;
// Pinecone caps metadata at 40KB per record. Keep a safety margin so the
// path + numeric fields fit comfortably.
const META_TEXT_CAP = 30_000;

const DEFAULT_INDEX = process.env.PINECONE_INDEX || "repoinsight";

let _pc: Pinecone | null = null;
let _openai: OpenAI | null = null;
let _indexReady = false;

function pc(): Pinecone {
  if (!process.env.PINECONE_API_KEY) {
    throw new Error("PINECONE_API_KEY is not set");
  }
  if (!_pc) _pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  return _pc;
}

function openai(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

async function ensureIndex(name: string): Promise<Index> {
  const client = pc();
  if (!_indexReady) {
    const { indexes = [] } = await client.listIndexes();
    if (!indexes.some((i) => i.name === name)) {
      await client.createIndex({
        name,
        dimension: EMBED_DIM,
        metric: "cosine",
        spec: { serverless: { cloud: "aws", region: "us-east-1" } },
        waitUntilReady: true,
      });
    }
    _indexReady = true;
  }
  return client.index(name);
}

export interface Chunk {
  id: string;
  path: string;
  chunkIdx: number;
  text: string;
}

/** Split one file into overlapping fixed-size chunks. */
export function chunkFile(file: ParsedFile, repoId: string): Chunk[] {
  const out: Chunk[] = [];
  const body = file.body;
  if (!body) return out;
  const safePath = file.path.replace(/[^\x20-\x7E]/g, "_");
  if (body.length <= CHUNK_CHARS) {
    out.push({
      id: `${repoId}::${safePath}::0`,
      path: file.path,
      chunkIdx: 0,
      text: body,
    });
    return out;
  }
  let start = 0;
  let idx = 0;
  while (start < body.length) {
    const end = Math.min(start + CHUNK_CHARS, body.length);
    out.push({
      id: `${repoId}::${safePath}::${idx}`,
      path: file.path,
      chunkIdx: idx,
      text: body.slice(start, end),
    });
    if (end === body.length) break;
    start = end - CHUNK_OVERLAP;
    idx++;
  }
  return out;
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  const res = await openai().embeddings.create({
    model: EMBED_MODEL,
    input: texts,
  });
  return res.data.map((d) => d.embedding);
}

export interface EmbedProgress {
  embedded: number;
  total: number;
  fileCount: number;
}

export interface EmbedResult {
  chunkCount: number;
  fileCount: number;
}

/**
 * Embed every file in the repo and upsert into Pinecone under namespace=repoId.
 * Existing vectors in the namespace are wiped first so re-running is idempotent.
 */
export async function embedRepo(
  repoId: string,
  files: ParsedFile[],
  onProgress?: (p: EmbedProgress) => void,
): Promise<EmbedResult> {
  const allChunks: Chunk[] = [];
  for (const f of files) allChunks.push(...chunkFile(f, repoId));
  const fileCount = files.length;

  if (allChunks.length === 0) {
    return { chunkCount: 0, fileCount };
  }

  const index = await ensureIndex(DEFAULT_INDEX);
  const ns = index.namespace(repoId);

  // Wipe any prior embeddings for this repo so re-runs replace cleanly.
  try {
    await ns.deleteAll();
  } catch {
    // namespace may not exist yet — that's fine.
  }

  let embedded = 0;
  for (let i = 0; i < allChunks.length; i += EMBED_BATCH) {
    const batch = allChunks.slice(i, i + EMBED_BATCH);
    const vectors = await embedTexts(batch.map((c) => c.text));
    const records = batch.map((c, j) => ({
      id: c.id,
      values: vectors[j],
      metadata: {
        path: c.path,
        chunkIdx: c.chunkIdx,
        text: c.text.length > META_TEXT_CAP ? c.text.slice(0, META_TEXT_CAP) : c.text,
      },
    }));
    await ns.upsert({ records });
    embedded += batch.length;
    onProgress?.({ embedded, total: allChunks.length, fileCount });
  }

  return { chunkCount: allChunks.length, fileCount };
}

export interface RetrievedChunk {
  path: string;
  text: string;
  score: number;
  chunkIdx: number;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  fileCount: number;
}

/** Top-K semantic retrieval scoped to a single repo's namespace. */
export async function retrieveRelevantChunks(
  repoId: string,
  query: string,
  k = 8,
): Promise<RetrievalResult> {
  const [queryVec] = await embedTexts([query]);
  const index = await ensureIndex(DEFAULT_INDEX);
  const ns = index.namespace(repoId);
  const res = await ns.query({
    vector: queryVec,
    topK: k,
    includeMetadata: true,
  });
  const chunks: RetrievedChunk[] = (res.matches ?? [])
    .map((m) => {
      const meta = m.metadata ?? {};
      return {
        path: String(meta.path ?? ""),
        text: String(meta.text ?? ""),
        score: m.score ?? 0,
        chunkIdx: Number(meta.chunkIdx ?? 0),
      };
    })
    .filter((c) => c.path && c.text);
  const fileCount = new Set(chunks.map((c) => c.path)).size;
  return { chunks, fileCount };
}

/** Render retrieved chunks for stuffing into the chat system prompt. */
export function formatChunksForPrompt(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";
  const blocks = chunks.map(
    (c) =>
      `## ${c.path}${c.chunkIdx > 0 ? ` (part ${c.chunkIdx + 1})` : ""}\n\n\`\`\`\n${c.text}\n\`\`\``,
  );
  return blocks.join("\n\n");
}
