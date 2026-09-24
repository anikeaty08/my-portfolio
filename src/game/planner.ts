import { projects } from "../content";

/**
 * Turns a free-text request ("take me to something with MCP") into a destination zone.
 * Deterministic keyword scoring — fast, offline, and explainable in the trace.
 */
export type Destination = { zone: string; label: string; words: string };

const PLACES: Destination[] = [
  { zone: "about", label: "About me (the cabin)", words: "about you who bio story background cabin person anikeat yourself" },
  { zone: "skills", label: "Skills scoreboard", words: "skill skills stack tech tools languages scoreboard know" },
  { zone: "contact", label: "Contact (the mailbox)", words: "contact email hire reach message mail talk touch" },
  { zone: "bowling", label: "Bowling alley", words: "bowl bowling pins strike game play fun" },
  { zone: "lighthouse", label: "Lighthouse", words: "lighthouse night dark sun lights" },
  { zone: "mcp", label: "MCP kiosk", words: "connect claude chatgpt assistant plug server kiosk endpoint" },
  { zone: "downtown", label: "Downtown", words: "downtown city town buildings traffic street streets" },
];

const PROJECT_DESTS: Destination[] = projects.map((p) => ({
  zone: `project:${p.slug}`,
  label: `${p.title} — ${p.tagline}`,
  words: [p.title, p.tagline, p.oneLiner, ...p.tech, "project projects work built build"].join(" ").toLowerCase(),
}));

const STOP = new Set(["take", "me", "to", "the", "your", "you", "show", "go", "drive", "with", "something", "some", "and", "for", "please", "want", "see", "what", "how", "can", "where", "who", "that", "its", "are", "any", "one", "this", "about"]);

export function plan(query: string): { dest: Destination; matched: string[] } | null {
  const q = query.toLowerCase().trim();
  if (!q) return null;
  if (/surprise|random|anything|best/.test(q)) {
    const dest = /best|top/.test(q) ? PROJECT_DESTS[0] : [...PROJECT_DESTS, ...PLACES][Math.floor(Math.random() * (PROJECT_DESTS.length + PLACES.length))];
    return { dest, matched: [/best|top/.test(q) ? "best" : "surprise"] };
  }
  // "about" is a stop word inside sentences but a destination on its own.
  if (/^about( you| me)?$/.test(q)) return { dest: PLACES[0], matched: ["about"] };
  const tokens = q.split(/[^a-z0-9+#.]+/).filter((t) => t.length > 2 && !STOP.has(t));
  const wantsProjects = /project|built|build|work|made/.test(q);
  let best: { dest: Destination; score: number; matched: string[] } | null = null;
  for (const dest of [...PROJECT_DESTS, ...PLACES]) {
    // Whole-word (prefix) matching, so "do" doesn't match "windows".
    const words = dest.words.toLowerCase().split(/[^a-z0-9+#.]+/);
    const matched = tokens.filter((t) => words.some((w) => w === t || (t.length > 3 && w.startsWith(t.replace(/s$/, "")))));
    let score = matched.length;
    if (wantsProjects && dest.zone.startsWith("project:")) score += 0.5;
    if (score > 0 && (!best || score > best.score)) best = { dest, score, matched };
  }
  return best ? { dest: best.dest, matched: best.matched } : null;
}

export const SUGGESTIONS = ["Your best AI project", "Something with MCP", "Show me your skills", "Downtown", "Bowling", "How do I contact you?"];
