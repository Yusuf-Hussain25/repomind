// OpenAI function-calling tools the agents can invoke during analysis.
//
// Four tools, kept deliberately small so the model can compose them rather
// than rely on one monster call:
//
//   • search_code     — semantic search over Pinecone (RAG-style)
//   • read_file       — full contents of one file in the indexed repo
//   • list_directory  — file paths under a directory prefix
//   • grep            — literal text search across all indexed files
//
// Each tool returns a string (what the model sees) plus a short preview
// (what the UI renders in the tool-call card).

import type { ParsedFile } from "@/lib/agents/parse";
import { retrieveRelevantChunks } from "@/lib/embed";

export interface ToolContext {
  repoId: string;
  files: ParsedFile[];
}

export interface ToolResult {
  ok: boolean;
  content: string;
  /** Short human-readable preview for the UI card. */
  preview: string;
}

/** OpenAI tool spec format. */
export const TOOL_SPECS = [
  {
    type: "function" as const,
    function: {
      name: "search_code",
      description:
        "Semantic search across the repository. Use when you want to find code related to a concept, not a literal string. Returns top-K matching chunks with file paths.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Natural-language description of what you're looking for.",
          },
          k: {
            type: "number",
            description: "How many chunks to return (default 6, max 12).",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "read_file",
      description:
        "Read the full contents of one file from the repository. Use when you need to see complete code, not just a snippet.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Repo-relative path (e.g. 'lib/auth.ts').",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_directory",
      description:
        "List file paths under a directory prefix. Use to explore repo structure before reading specific files.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Directory prefix (e.g. 'lib' or 'app/api'). Pass '' or '/' for the root.",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "grep",
      description:
        "Literal (case-insensitive) substring search across all indexed files. Returns up to 30 hits as path:line snippets. Use for exact identifiers, error strings, etc.",
      parameters: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "Substring to find. No regex — literal match.",
          },
        },
        required: ["pattern"],
      },
    },
  },
];

const MAX_FILE_CHARS = 40_000;
const MAX_GREP_HITS = 30;
const MAX_DIR_ENTRIES = 200;
const MAX_PREVIEW = 140;

function previewOf(s: string): string {
  const oneline = s.replace(/\s+/g, " ").trim();
  return oneline.length > MAX_PREVIEW ? oneline.slice(0, MAX_PREVIEW) + "…" : oneline;
}

async function searchCode(
  ctx: ToolContext,
  args: { query: string; k?: number },
): Promise<ToolResult> {
  if (!process.env.PINECONE_API_KEY) {
    return {
      ok: false,
      content: "search_code unavailable: PINECONE_API_KEY not set. Use grep or read_file instead.",
      preview: "Pinecone unavailable — falling back",
    };
  }
  const k = Math.max(1, Math.min(args.k ?? 6, 12));
  const { chunks, fileCount } = await retrieveRelevantChunks(ctx.repoId, args.query, k);
  if (chunks.length === 0) {
    return {
      ok: true,
      content: "No matching chunks found.",
      preview: `No matches for "${args.query}"`,
    };
  }
  const body = chunks
    .map(
      (c, i) =>
        `[${i + 1}] ${c.path} (score=${c.score.toFixed(3)})\n\n${c.text.slice(0, 1200)}${c.text.length > 1200 ? "\n…[truncated]" : ""}`,
    )
    .join("\n\n---\n\n");
  return {
    ok: true,
    content: body,
    preview: `${chunks.length} chunks across ${fileCount} file${fileCount === 1 ? "" : "s"}`,
  };
}

function readFile(ctx: ToolContext, args: { path: string }): ToolResult {
  const want = args.path.replace(/^\.?\//, "");
  const file = ctx.files.find((f) => f.path === want) ||
    ctx.files.find((f) => f.path.endsWith("/" + want)) ||
    ctx.files.find((f) => f.path === "/" + want);
  if (!file) {
    return {
      ok: false,
      content: `File not found: ${args.path}. Use list_directory to discover available paths.`,
      preview: `Not found: ${args.path}`,
    };
  }
  const truncated = file.body.length > MAX_FILE_CHARS;
  const body = truncated
    ? file.body.slice(0, MAX_FILE_CHARS) + "\n\n[... truncated to fit token budget ...]"
    : file.body;
  return {
    ok: true,
    content: body,
    preview: `${file.path} (${file.body.length.toLocaleString()} chars${truncated ? ", truncated" : ""})`,
  };
}

function listDirectory(ctx: ToolContext, args: { path: string }): ToolResult {
  let prefix = (args.path ?? "").trim();
  if (prefix === "/" || prefix === ".") prefix = "";
  if (prefix && !prefix.endsWith("/")) prefix += "/";

  const matches = ctx.files
    .map((f) => f.path)
    .filter((p) => (prefix === "" ? true : p.startsWith(prefix)))
    .sort();

  if (matches.length === 0) {
    return {
      ok: true,
      content: `No files under '${args.path || "/"}'.`,
      preview: `Empty: ${args.path || "/"}`,
    };
  }
  const shown = matches.slice(0, MAX_DIR_ENTRIES);
  const more = matches.length - shown.length;
  const body = shown.join("\n") + (more > 0 ? `\n…and ${more} more` : "");
  return {
    ok: true,
    content: body,
    preview: `${matches.length} file${matches.length === 1 ? "" : "s"} under ${args.path || "/"}`,
  };
}

function grep(ctx: ToolContext, args: { pattern: string }): ToolResult {
  const needle = (args.pattern ?? "").toLowerCase();
  if (!needle) {
    return { ok: false, content: "Empty pattern.", preview: "Empty pattern" };
  }
  const hits: string[] = [];
  outer: for (const f of ctx.files) {
    const lines = f.body.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(needle)) {
        hits.push(`${f.path}:${i + 1}: ${lines[i].trim().slice(0, 200)}`);
        if (hits.length >= MAX_GREP_HITS) break outer;
      }
    }
  }
  if (hits.length === 0) {
    return {
      ok: true,
      content: `No matches for "${args.pattern}".`,
      preview: `No hits for "${args.pattern}"`,
    };
  }
  return {
    ok: true,
    content: hits.join("\n"),
    preview: `${hits.length} hit${hits.length === 1 ? "" : "s"} for "${args.pattern}"`,
  };
}

/**
 * Execute a tool call. Returns string content (for the model) and a short
 * UI preview. Never throws — returns ok=false on failure.
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    switch (name) {
      case "search_code":
        return await searchCode(ctx, args as { query: string; k?: number });
      case "read_file":
        return readFile(ctx, args as { path: string });
      case "list_directory":
        return listDirectory(ctx, args as { path: string });
      case "grep":
        return grep(ctx, args as { pattern: string });
      default:
        return {
          ok: false,
          content: `Unknown tool: ${name}`,
          preview: `Unknown tool: ${name}`,
        };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      content: `Tool ${name} failed: ${message}`,
      preview: `Error: ${previewOf(message)}`,
    };
  }
}
