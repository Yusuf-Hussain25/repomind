// Helpers for slicing the indexed context document the analyzer was built on.
//
// `buildContextDocument` (lib/github.ts) emits each file as:
//   ## File: <path>
//
//   ```
//   <content>
//   ```
//
// We need cheap slicing so downstream agents only see the files we picked,
// not the whole dump.

const FILE_HEADER_RE = /^## File: (.+)$/gm;

export interface ParsedFile {
  path: string;
  body: string;
}

export function parseContextDoc(doc: string): ParsedFile[] {
  const files: ParsedFile[] = [];
  const matches = [...doc.matchAll(FILE_HEADER_RE)];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const headerEnd = (m.index ?? 0) + m[0].length;
    const blockEnd = i + 1 < matches.length ? (matches[i + 1].index ?? doc.length) : doc.length;
    const block = doc.slice(headerEnd, blockEnd);
    // Strip the surrounding ``` fences.
    const fenceOpen = block.indexOf("```");
    const fenceClose = block.lastIndexOf("```");
    let body = block;
    if (fenceOpen !== -1 && fenceClose > fenceOpen) {
      body = block.slice(fenceOpen + 3, fenceClose);
      // Drop optional language tag on the open fence's same line.
      const nl = body.indexOf("\n");
      if (nl !== -1 && body.slice(0, nl).trim().length > 0 && !/[\s]/.test(body.slice(0, nl).trim())) {
        body = body.slice(nl + 1);
      } else {
        body = body.replace(/^\n/, "");
      }
    }
    files.push({ path: m[1].trim(), body: body.trim() });
  }
  return files;
}

/** "path  N chars" lines for the Planner / FileSelector to read. */
export function manifest(files: ParsedFile[]): string {
  return files.map((f) => `${f.path}\t${f.body.length} chars`).join("\n");
}

/** Re-emit only the chosen files in a compact, model-friendly form. */
export function selectedDoc(files: ParsedFile[], paths: string[], maxChars = 80_000): string {
  const set = new Set(paths);
  const picked = files.filter((f) => set.has(f.path));
  const blocks = picked.map((f) => `## File: ${f.path}\n\n\`\`\`\n${f.body}\n\`\`\``);
  let joined = blocks.join("\n\n");
  if (joined.length > maxChars) {
    joined = joined.slice(0, maxChars) + "\n\n[... truncated to fit token budget ...]";
  }
  return joined;
}
