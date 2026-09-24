/**
 * Live "now shipping" data for the island's live board: latest pushed repos, pushes this week and
 * active repos this month. Cached at the edge for 30 minutes.
 * Set GITHUB_TOKEN in Vercel to raise GitHub's rate limit (optional).
 */
import type { IncomingMessage, ServerResponse } from "node:http";

const USER = "anikeaty08";

async function json<T>(url: string, headers: Record<string, string> = {}): Promise<T | null> {
  try {
    const r = await fetch(url, { headers: { "user-agent": "anikeat-portfolio", ...headers } });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

export default async function pulse(_req: IncomingMessage, res: ServerResponse) {
  const gh: Record<string, string> = { accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) gh.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const [repos, events] = await Promise.all([
    json<{ name: string; pushed_at: string; fork: boolean; language: string | null }[]>(`https://api.github.com/users/${USER}/repos?sort=pushed&per_page=30`, gh),
    json<{ type: string; created_at: string }[]>(`https://api.github.com/users/${USER}/events/public?per_page=100`, gh),
  ]);

  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const monthAgo = Date.now() - 30 * 24 * 3600 * 1000;
  // GitHub's public events no longer include commit counts, so count pushes.
  const pushesThisWeek = (events ?? []).filter((e) => e.type === "PushEvent" && Date.parse(e.created_at) > weekAgo).length;
  const activeRepos = (repos ?? []).filter((r) => !r.fork && Date.parse(r.pushed_at) > monthAgo).length;

  const body = {
    updated: new Date().toISOString(),
    repos: (repos ?? [])
      .filter((r) => !r.fork && r.name !== USER)
      .slice(0, 5)
      .map((r) => ({ name: r.name, pushedAt: r.pushed_at, language: r.language })),
    pushesThisWeek: events ? pushesThisWeek : null,
    activeRepos: repos ? activeRepos : null,
  };

  res.statusCode = 200;
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "public, s-maxage=1800, stale-while-revalidate=86400");
  res.setHeader("access-control-allow-origin", "*");
  res.end(JSON.stringify(body));
}
