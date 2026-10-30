import { useState, type ReactNode } from "react";
import { diagramSizes } from "../data/diagram-sizes";
import { AlertTriangle, Check, CheckCircle2, Copy, Lightbulb, Sparkles, Wrench, type LucideIcon } from "lucide-react";

// Small, safe markdown renderer. Builds React elements only, never raw HTML.
const safeUrl = (u: string) => (/^(https?:|mailto:|\/(?!\/)|#[a-z0-9-]+$)/i.test(u) ? u : "#");
const safeSrc = (u: string) => (/^(\/(?!\/)|https:)/i.test(u) ? u : "");

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Level-2 headings, for a table of contents. Skips anything inside code fences. */
export function headingsOf(source: string) {
  const out: { id: string; text: string }[] = [];
  let fenced = false;
  for (const line of source.replace(/\r\n/g, "\n").split("\n")) {
    if (line.startsWith("```")) fenced = !fenced;
    else if (!fenced && /^##\s/.test(line)) {
      const text = line.replace(/^##\s+/, "");
      out.push({ id: slugify(text), text });
    }
  }
  return out;
}

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = m.index;
    if (t.startsWith("`"))
      out.push(
        <code key={k} className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[0.85em] text-fg">
          {t.slice(1, -1)}
        </code>,
      );
    else if (t.startsWith("**")) out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("*")) out.push(<em key={k}>{t.slice(1, -1)}</em>);
    else {
      const link = /\[([^\]]+)\]\(([^)]+)\)/.exec(t);
      if (link)
        out.push(
          <a key={k} href={safeUrl(link[2])} target={link[2].startsWith("#") ? undefined : "_blank"} rel="noreferrer noopener" onClick={link[2].startsWith("#") ? (event) => { event.preventDefault(); document.getElementById(link[2].slice(1))?.scrollIntoView({ behavior: "smooth" }); } : undefined} className="text-accent underline underline-offset-4">
            {link[1]}
          </a>,
        );
    }
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const CALLOUTS: Record<string, { Icon: LucideIcon; tone: string; chip: string }> = {
  why: { Icon: Lightbulb, tone: "border-violet-400/40 bg-violet-400/10", chip: "bg-violet-400/25" },
  "do this": { Icon: Wrench, tone: "border-sky-400/40 bg-sky-400/10", chip: "bg-sky-400/25" },
  check: { Icon: CheckCircle2, tone: "border-emerald-400/40 bg-emerald-400/10", chip: "bg-emerald-400/25" },
  careful: { Icon: AlertTriangle, tone: "border-rose-400/40 bg-rose-400/10", chip: "bg-rose-400/25" },
  tip: { Icon: Sparkles, tone: "border-amber-400/40 bg-amber-400/10", chip: "bg-amber-400/25" },
};

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  const block = (
    <div className="overflow-hidden rounded-2xl border border-border bg-[#0b0d1c] text-zinc-200">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 font-mono text-xs text-zinc-400">
        <span>{lang || "text"}</span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard
              ?.writeText(code)
              .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              })
              .catch(() => undefined);
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 transition hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed sm:text-sm">
        <code>{code}</code>
      </pre>
    </div>
  );
  const lines = code.split("\n").length;
  if (lang !== "python" || lines < 20) return block;
  return (
    <details className="group rounded-2xl border border-border bg-surface-2/50 p-3">
      <summary className="cursor-pointer px-2 py-1 font-mono text-sm text-accent">
        Show Python code <span className="text-muted">· {lines} lines</span>
      </summary>
      <div className="mt-3">{block}</div>
    </details>
  );
}

const BLOCK_START = /^(#{1,4}\s|[-*]\s|\d+\.\s|>\s|```|\||!\[|---+\s*$)/;
const prose = "article-body max-w-[68ch]";
const splitRow = (row: string) =>
  row
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
    } else if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
      i++;
      blocks.push(<CodeBlock key={key++} code={code.join("\n")} lang={lang} />);
    } else if (/^---+\s*$/.test(line)) {
      blocks.push(<hr key={key++} className="border-border" />);
      i++;
    } else if (/^#{1,4}\s/.test(line)) {
      const level = line.match(/^#+/)![0].length;
      const raw = line.replace(/^#+\s/, "");
      const id = slugify(raw);
      if (level <= 2) {
        const step = /^Step (\d+)[:.]?\s*(.*)$/.exec(raw);
        blocks.push(
          <h2
            key={key++}
            id={id}
            className="font-display mt-16 flex items-center gap-4 border-t border-border pt-10 text-3xl font-semibold first:mt-0 first:border-0 first:pt-0 sm:text-4xl"
          >
            {step ? (
              <>
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand text-lg font-bold text-accent-ink">{step[1]}</span>
                <span>{step[2]}</span>
              </>
            ) : (
              inline(raw)
            )}
          </h2>,
        );
      } else if (level === 3) {
        blocks.push(
          <h3 key={key++} id={id} className="font-display mt-10 text-2xl font-semibold">
            {inline(raw)}
          </h3>,
        );
      } else {
        blocks.push(
          <h4 key={key++} id={id} className="mt-8 font-sans text-sm font-semibold uppercase tracking-widest text-accent">
            {inline(raw)}
          </h4>,
        );
      }
      i++;
    } else if (/^!\[/.test(line)) {
      const img = /^!\[([^\]]*)\]\(([^)]+)\)/.exec(line);
      i++;
      const src = img ? safeSrc(img[2]) : "";
      if (img && src)
        blocks.push(
          <figure key={key++} className="space-y-2">
            <div className="overflow-x-auto rounded-3xl border border-border">
              <img
                src={src}
                alt={img[1]}
                width={diagramSizes[src]?.[0]}
                height={diagramSizes[src]?.[1]}
                loading="lazy"
                className="mx-auto block h-auto max-w-full min-w-[680px]"
              />
            </div>
            <figcaption className="flex flex-wrap justify-between gap-2 text-sm text-muted">
              <span>{img[1]}</span>
              <a href={src} target="_blank" rel="noreferrer noopener" className="text-accent underline underline-offset-4">
                Open full size
              </a>
            </figcaption>
          </figure>,
        );
    } else if (line.trim().startsWith("|") && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1] ?? "")) {
      const head = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(splitRow(lines[i++]));
      blocks.push(
        <div key={key++} className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead className="bg-surface-2">
              <tr>
                {head.map((h, n) => (
                  <th key={n} className="px-4 py-3 font-semibold">
                    {inline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, n) => (
                <tr key={n} className="border-t border-border align-top">
                  {r.map((c, m) => (
                    <td key={m} className="px-4 py-3 text-muted first:font-medium first:text-fg">
                      {inline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    } else if (/^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) items.push(lines[i++].replace(/^[-*]\s/, ""));
      blocks.push(
        <ul key={key++} className={`${prose} list-disc space-y-2 pl-6 marker:text-accent`}>
          {items.map((it, n) => (
            <li key={n}>{inline(it)}</li>
          ))}
        </ul>,
      );
    } else if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) items.push(lines[i++].replace(/^\d+\.\s/, ""));
      blocks.push(
        <ol key={key++} className={`${prose} list-decimal space-y-2 pl-6 marker:font-semibold marker:text-accent`}>
          {items.map((it, n) => (
            <li key={n}>{inline(it)}</li>
          ))}
        </ol>,
      );
    } else if (/^>\s/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^>\s/.test(lines[i])) q.push(lines[i++].replace(/^>\s/, ""));
      const text = q.join(" ");
      const tag = /^\*\*([A-Za-z ]+?)[:.]?\*\*\s*(.*)$/.exec(text);
      const kind = tag ? CALLOUTS[tag[1].toLowerCase()] : undefined;
      if (tag && kind) {
        const { Icon } = kind;
        blocks.push(
          <aside key={key++} className={`${prose} flex gap-4 rounded-2xl border p-4 sm:p-5 ${kind.tone}`}>
            <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${kind.chip}`}>
              <Icon size={18} aria-hidden />
            </span>
            <p className="article-body">
              <strong className="font-hand mr-2 text-2xl leading-none">{tag[1]}.</strong>
              {inline(tag[2])}
            </p>
          </aside>,
        );
      } else {
        blocks.push(
          <blockquote key={key++} className={`${prose} article-quote border-l-2 border-accent pl-6 text-muted`}>
            {inline(text)}
          </blockquote>,
        );
      }
    } else {
      const p: string[] = [];
      while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i])) p.push(lines[i++]);
      if (!p.length) p.push(lines[i++]);
      blocks.push(
        <p key={key++} className={prose}>
          {inline(p.join(" "))}
        </p>,
      );
    }
  }

  return <div className="space-y-5">{blocks}</div>;
}
