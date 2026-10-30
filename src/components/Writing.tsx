import { useEffect, useMemo, useRef } from "react";
import autoAnimate from "@formkit/auto-animate";
import { ArrowUpRight, Clock, PenLine } from "lucide-react";
import { staticArticles } from "../data/articles";
import { profile } from "../data/content";
import { readingTime, useArticles } from "../lib/articles";
import { useIsOwner } from "../lib/owner";
import { articleHref } from "../lib/route";
import { Section } from "./Section";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function Writing({ onWrite }: { onWrite: () => void }) {
  const local = useArticles();
  const isOwner = useIsOwner();
  const articles = useMemo(
    () => [...local, ...staticArticles].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [local],
  );
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (listRef.current) autoAnimate(listRef.current, { duration: 220 });
  }, []);

  return (
    <Section
      id="writing"
      eyebrow="04 — Tutorials"
      title="Writing"
      action={
        isOwner && (
          <button
            onClick={onWrite}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-medium text-accent-ink transition hover:opacity-90"
          >
            <PenLine size={16} aria-hidden /> Write article
          </button>
        )
      }
    >
      <ul ref={listRef} className="grid gap-5 md:grid-cols-2">
        {articles.map((a) => (
          <li key={a.id}>
            <a
              href={articleHref(a.id)}
              className="group flex h-full flex-col rounded-3xl border border-border bg-card p-6 transition hover:border-accent/60 sm:p-7"
            >
              <span className="flex items-center gap-3 font-mono text-xs text-muted">
                {a.author ?? profile.name} · {fmt(a.createdAt)}
                <span className="inline-flex items-center gap-1">
                  <Clock size={12} aria-hidden /> {readingTime(a.body)} min
                </span>
              </span>
              <span className="font-display mt-3 text-2xl font-semibold leading-snug">{a.title}</span>
              <span className="font-article mt-3 text-muted">{a.summary}</span>
              {a.tags.length > 0 && (
                <span className="mt-5 flex flex-wrap gap-2">
                  {a.tags.map((t) => (
                    <span key={t} className="rounded-full border border-border bg-surface-2 px-2.5 py-0.5 font-mono text-xs text-muted">
                      {t}
                    </span>
                  ))}
                </span>
              )}
              <span className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-medium text-accent">
                Read the tutorial <ArrowUpRight size={15} aria-hidden className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </Section>
  );
}
