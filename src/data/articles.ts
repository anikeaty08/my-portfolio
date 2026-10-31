import type { Article } from "../lib/articles";
import { profile } from "./content";
import ragBody from "./rag-article.md?raw";

// Built-in articles are part of the site, so every visitor sees them.
export const staticArticles: Article[] = [
  {
    id: "rag-complete-guide",
    title: "The source was real. The policy was wrong.",
    summary:
      "An archived policy led a model to one answer. The current policy led it to another — but still left room for unsupported advice. A practical case study in tracing retrieval failures, improving RAG pipelines, and understanding when graph-based retrieval or agents are worth introducing.",
    tags: ["RAG", "Case study", "Graph RAG", "Agentic RAG", "Web search"],
    body: ragBody,
    createdAt: "2026-10-16T09:00:00.000Z",
    author: profile.name,
    readonly: true,
  },
];
