import { lazy, Suspense, useEffect, useState } from "react";
import { Toaster } from "sonner";
import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import { Experience } from "./components/Experience";
import { Projects } from "./components/Projects";
import { Skills } from "./components/Skills";
import { OwnerDialog } from "./components/OwnerDialog";
import { useIsOwner } from "./lib/owner";
import { articleIdFromHash, scrollToId, useHash } from "./lib/route";

// Below-the-fold, article and owner-only code is split out of the first load.
const Writing = lazy(() => import("./components/Writing"));
const Contact = lazy(() => import("./components/Contact"));
const ArticlePage = lazy(() => import("./components/ArticlePage"));
const ArticleEditor = lazy(() => import("./components/ArticleEditor").then((m) => ({ default: m.ArticleEditor })));

function SectionSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-28 sm:px-6" aria-hidden>
      <div className="skeleton h-4 w-24" />
      <div className="skeleton mt-4 h-9 w-64" />
      <div className="skeleton mt-10 h-40 w-full" />
    </div>
  );
}

export default function App() {
  const isOwner = useIsOwner();
  const hash = useHash();
  const articleId = articleIdFromHash(hash);
  const [writing, setWriting] = useState(false);
  const [signIn, setSignIn] = useState(false);

  // A hash like #/article/<id> is a page; a plain hash like #projects scrolls to that section.
  useEffect(() => {
    if (articleId) window.scrollTo(0, 0);
    else if (hash.length > 1 && !hash.startsWith("#/")) scrollToId(hash.slice(1));
  }, [articleId, hash]);

  return (
    <>
      <a
        href={articleId ? "#writing" : "#experience"}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink"
      >
        {articleId ? "Back to the portfolio" : "Skip to content"}
      </a>
      <Nav onWrite={() => setWriting(true)} activeHash={hash} isArticle={Boolean(articleId)} />

      {articleId ? (
        <Suspense fallback={<SectionSkeleton />}>
          <ArticlePage id={articleId} />
        </Suspense>
      ) : (
        <main>
          <Hero />
          <Experience />
          <Projects />
          <Skills />
          <Suspense fallback={<SectionSkeleton />}>
            <Writing onWrite={() => setWriting(true)} />
            <Contact />
          </Suspense>
        </main>
      )}

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-sm text-muted sm:px-6">
          <p>© {new Date().getFullYear()} Anikeat Yadav · Bengaluru</p>
          {!isOwner && (
            <button onClick={() => setSignIn(true)} className="h-11 rounded-lg px-3 hover:text-fg">
              Owner sign-in
            </button>
          )}
        </div>
      </footer>

      {isOwner && writing && (
        <Suspense fallback={null}>
          <ArticleEditor open={writing} onOpenChange={setWriting} />
        </Suspense>
      )}
      <OwnerDialog open={signIn} onOpenChange={setSignIn} />
      <Toaster position="bottom-right" theme="system" closeButton />
    </>
  );
}
