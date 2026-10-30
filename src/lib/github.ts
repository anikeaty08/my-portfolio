import { useEffect, useState } from "react";
import { profile } from "../data/content";

export interface GithubStats {
  repos: number;
  followers: number;
  stars: number;
}

const CACHE_KEY = "gh-stats-v1";
const TTL = 1000 * 60 * 30;

function readCache(): GithubStats | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw) as { at: number; data: GithubStats };
    return Date.now() - at < TTL ? data : null;
  } catch {
    return null;
  }
}

/** Live GitHub numbers. `undefined` while loading, `null` if the request failed. */
export function useGithubStats() {
  const [stats, setStats] = useState<GithubStats | null | undefined>(() => readCache() ?? undefined);

  useEffect(() => {
    if (stats !== undefined) return;
    const ctrl = new AbortController();
    const base = `https://api.github.com/users/${profile.githubUser}`;
    Promise.all([
      fetch(base, { signal: ctrl.signal }).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
      fetch(`${base}/repos?per_page=100`, { signal: ctrl.signal }).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
    ])
      .then(([user, repos]: [{ public_repos: number; followers: number }, { stargazers_count: number }[]]) => {
        const data: GithubStats = {
          repos: user.public_repos,
          followers: user.followers,
          stars: repos.reduce((n, r) => n + r.stargazers_count, 0),
        };
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
        } catch {
          /* ignore */
        }
        setStats(data);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setStats(null);
      });
    return () => ctrl.abort();
  }, [stats]);

  return stats;
}
