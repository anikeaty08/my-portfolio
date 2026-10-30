import { useEffect, useMemo, useState } from "react";
import { motion, useScroll, useSpring } from "motion/react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { ArrowLeft, Clock, ListTree, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { staticArticles } from "../data/articles";
import { profile } from "../data/content";
import { readingTime, removeArticle, useArticles } from "../lib/articles";
import { headingsOf, Markdown } from "../lib/markdown";
import { useIsOwner } from "../lib/owner";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

function useActiveHeading(ids: string[]) {
  const [active, setActive] = useState(ids[0] ?? "");
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    if (!els.length) return;
    let frame = 0;
    // The current section is the last heading that has scrolled up near the top of the screen.
    const update = () => {
      frame = 0;
      let current = els[0].id;
      for (const el of els) {
        if (el.getBoundingClientRect().top <= 200) current = el.id;
        else break;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => {
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ids]);
  return active;
}

export default function ArticlePage({ id }: { id: string }) {
  const local = useArticles();
  const isOwner = useIsOwner();
  const article = useMemo(() => [...staticArticles, ...local].find((a) => a.id === id), [local, id]);
  const toc = useMemo(() => (article ? headingsOf(article.body) : []), [article]);
  const active = useActiveHeading(useMemo(() => toc.map((t) => t.id), [toc]));
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!article) return;
    const previous = document.title;
    document.title = `${article.title} · ${profile.name}`;
    return () => {
      document.title = previous;
    };
  }, [article]);

  if (!article)
    return (
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-40 text-center">
        <h1 className="text-3xl font-semibold">Article not found</h1>
        <p className="mt-3 text-muted">It may have been deleted, or it was saved in a different browser.</p>
        <a href="#writing" className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl border border-border px-5 hover:border-accent">
          <ArrowLeft size={16} aria-hidden /> Back to writing
        </a>
      </main>
    );

  return (
    <main className="pb-24 pt-8 md:pt-12">
      <motion.div aria-hidden style={{ scaleX: progress }} className="fixed inset-x-0 top-0 z-[60] h-1 origin-left bg-brand" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <a href="#writing" className="inline-flex h-11 items-center gap-2 text-sm text-muted transition hover:text-fg">
          <ArrowLeft size={16} aria-hidden /> Back to writing
        </a>

        <header className="mt-6 max-w-4xl">
          <ul className="flex flex-wrap gap-2" aria-label="Topics">
            {article.tags.map((t) => (
              <li key={t} className="rounded-full border border-border bg-surface-2 px-3 py-1 font-mono text-xs text-muted">
                {t}
              </li>
            ))}
          </ul>
          <h1 className="font-display mt-5 text-[2rem] font-semibold leading-[1.12] sm:text-5xl sm:leading-[1.08] lg:text-6xl">{article.title}</h1>
          <p className="font-article mt-5 max-w-3xl text-xl leading-relaxed text-muted">{article.summary}</p>
          <p className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span className="font-medium text-fg">By {article.author ?? profile.name}</span>
            <span>{fmt(article.createdAt)}</span>
            <span className="inline-flex items-center gap-1.5">
              <Clock size={14} aria-hidden /> {readingTime(article.body)} min read
            </span>
          </p>
        </header>

        <details className="mt-8 rounded-2xl border border-border bg-card p-4 lg:hidden">
          <summary className="cursor-pointer text-sm font-medium">Jump to a chapter</summary>
          <nav aria-label="Article chapters" className="mt-4 max-h-72 overflow-y-auto border-t border-border pt-3">
            <ol className="grid gap-1">
              {toc.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => document.getElementById(t.id)?.scrollIntoView({ behavior: "smooth" })} className="block w-full rounded-lg px-2 py-1.5 text-left text-sm text-muted hover:bg-surface-2 hover:text-fg">
                    {t.text}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        </details>

        <div className="mt-12 grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <nav aria-label="Table of contents" className="sticky top-28 max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-3xl border border-border bg-card p-4">
              <p className="mb-3 flex items-center gap-2 px-2 font-mono text-xs uppercase tracking-widest text-muted">
                <ListTree size={14} aria-hidden /> In this article
              </p>
              <ol className="space-y-0.5">
                {toc.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => document.getElementById(t.id)?.scrollIntoView({ behavior: "smooth" })}
                      aria-current={active === t.id ? "true" : undefined}
                      className={`w-full rounded-xl px-2.5 py-1.5 text-left text-[13px] leading-snug transition ${
                        active === t.id ? "bg-accent/15 font-medium text-fg" : "text-muted hover:bg-surface-2 hover:text-fg"
                      }`}
                    >
                      {t.text}
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          <article className="min-w-0 rounded-[2rem] border border-border bg-card p-5 sm:p-10">
            <div className="article-lede">
              <Markdown source={article.body} />
            </div>

            {isOwner && !article.readonly && (
              <div className="mt-12 border-t border-border pt-6">
                <button
                  onClick={() => setConfirming(true)}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm text-red-400 transition hover:border-red-400"
                >
                  <Trash2 size={15} aria-hidden /> Delete article
                </button>
              </div>
            )}
          </article>
        </div>
      </div>

      <AlertDialog.Root open={confirming} onOpenChange={setConfirming}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-[70] bg-black/60" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[70] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-surface p-6">
            <AlertDialog.Title className="text-lg font-semibold">Delete this article?</AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-muted">“{article.title}” will be removed. This can't be undone.</AlertDialog.Description>
            <div className="mt-6 flex justify-end gap-3">
              <AlertDialog.Cancel className="h-11 rounded-xl border border-border px-5 text-sm font-medium hover:bg-surface-2">Keep it</AlertDialog.Cancel>
              <AlertDialog.Action
                onClick={() => {
                  removeArticle(article.id);
                  toast("Article deleted");
                  location.hash = "#writing";
                }}
                className="h-11 rounded-xl bg-red-500 px-5 text-sm font-medium text-white hover:bg-red-600"
              >
                Delete
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </main>
  );
}
