import type { Article } from "../lib/articles";
import { profile } from "./content";
import ragBody from "./rag-article.md?raw";

// Built-in articles are part of the site, so every visitor sees them.
export const staticArticles: Article[] = [
  {
    id: "rag-complete-guide",
    title: "The source was real. The policy was wrong.",
    summary:
      "An archived policy made a model say yes. The current one made it say no—and still produced unsupported advice. Follow the evidence through the fixes, then see when graphs and agents actually help.",
    tags: ["RAG", "Case study", "Graph RAG", "Agentic RAG", "Web search"],
    body: ragBody,
    createdAt: "2026-10-16T09:00:00.000Z",
    author: profile.name,
    readonly: true,
  },
];
