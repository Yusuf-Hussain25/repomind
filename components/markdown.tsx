import { Fragment } from "react";

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={key++} className="text-[var(--fg)] font-semibold">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      parts.push(
        <code
          key={key++}
          className="rounded-md bg-[var(--bg-soft)] border border-[var(--border-muted)] px-1.5 py-0.5 text-[0.85em] font-mono text-[var(--accent)]"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      const m = /\[([^\]]+)\]\(([^)]+)\)/.exec(token);
      if (m) {
        parts.push(
          <a
            key={key++}
            href={m[2]}
            className="text-[var(--accent)] hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            {m[1]}
          </a>,
        );
      }
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length === 0 ? text : parts;
}

export function Markdown({ source }: { source: string }) {
  const lines = source.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      blocks.push(
        <pre
          key={key++}
          className="rounded-xl bg-[#010409] border border-[var(--border-muted)] p-4 overflow-x-auto text-sm font-mono my-4 text-[var(--fg-muted)]"
        >
          <code data-lang={lang}>{buf.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push(
        <h2
          key={key++}
          className="text-lg font-semibold mt-8 mb-3 pb-2 border-b border-[var(--border-muted)] text-[var(--fg)] tracking-tight flex items-center gap-2 first:mt-0"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          {line.slice(3)}
        </h2>,
      );
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      blocks.push(
        <h1 key={key++} className="text-2xl font-bold mt-6 mb-3 text-[var(--fg)] tracking-tight">
          {line.slice(2)}
        </h1>,
      );
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push(
        <h3 key={key++} className="text-base font-semibold mt-5 mb-2 text-[var(--fg)]">
          {line.slice(4)}
        </h3>,
      );
      i++;
      continue;
    }

    if (/^[-*] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(lines[i].slice(2));
        i++;
      }
      blocks.push(
        <ul key={key++} className="my-3 space-y-1.5">
          {items.map((it, j) => (
            <li key={j} className="pl-5 relative text-[var(--fg-muted)] leading-relaxed">
              <span className="absolute left-0 top-[0.6em] h-1.5 w-1.5 rounded-full bg-[var(--accent)]/60" />
              {renderInline(it)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(#|```|[-*] )/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} className="my-3 leading-relaxed text-[var(--fg-muted)]">
        {para.map((l, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {renderInline(l)}
          </Fragment>
        ))}
      </p>,
    );
  }

  return <div className="text-[var(--fg)] text-[15px]">{blocks}</div>;
}
