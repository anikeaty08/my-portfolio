import { useSyncExternalStore } from "react";

export interface Article {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  body: string;
  createdAt: string;
  author?: string;
  /** Built-in articles ship with the site and cannot be deleted. */
  readonly?: boolean;
}

const KEY = "articles-v1";
const EMPTY: Article[] = [];
const listeners = new Set<() => void>();
let cache: Article[] | null = null;

function load(): Article[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Article[]) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function snapshot() {
  return (cache ??= load());
}

function save(next: Article[]) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: articles last until reload */
  }
  listeners.forEach((l) => l());
}

export function addArticle(a: Omit<Article, "id" | "createdAt">) {
  const article: Article = { ...a, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  save([article, ...snapshot()]);
  return article;
}

export function removeArticle(id: string) {
  save(snapshot().filter((a) => a.id !== id));
}

export function useArticles() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    snapshot,
    () => EMPTY,
  );
}

export const readingTime = (body: string) => {
  const prose = body.replace(/```[\s\S]*?```/g, " ").trim();
  return Math.max(1, Math.round(prose.split(/\s+/).length / 220));
};
