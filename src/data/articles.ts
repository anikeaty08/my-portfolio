import type { Article } from "../lib/articles";
import { profile } from "./content";
import ragBody from "./rag-article.md?raw";

// Built-in articles are part of the site, so every visitor sees them.
export const staticArticles: Article[] = [
  {
    id: "rag-complete-guide",
    title: "The page was real. The rule was out of date.",
    summary:
      "A student asks about re-evaluating their marks. An archived rule says yes; the current rule says no. A beginner-friendly case study that builds RAG from scratch with one running example, real traces, simple math and hand-drawn diagrams, and shows when graph retrieval or agents are worth adding.",
    tags: ["RAG", "Case study", "Graph RAG", "Agentic RAG", "Web search"],
    body: ragBody,
    createdAt: "2026-10-16T09:00:00.000Z",
    author: profile.name,
    readonly: true,
  },
];
