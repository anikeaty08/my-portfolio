import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { WorldData } from "./World";

export type Pulse = {
  updated: string;
  repos: { name: string; pushedAt: string; language: string | null }[];
  pushesThisWeek: number | null;
  activeRepos: number | null;
};

/** Fetches live data from /api/pulse; falls back to GitHub directly (e.g. in local dev). */
export async function loadPulse(): Promise<Pulse | null> {
  try {
    const r = await fetch("/api/pulse");
    if (r.ok && r.headers.get("content-type")?.includes("json")) return (await r.json()) as Pulse;
  } catch {
    /* fall through */
  }
  try {
    const r = await fetch("https://api.github.com/users/anikeaty08/repos?sort=pushed&per_page=12");
    if (!r.ok) return null;
    const repos = (await r.json()) as { name: string; pushed_at: string; fork: boolean; language: string | null }[];
    return {
      updated: new Date().toISOString(),
      repos: repos.filter((x) => !x.fork && x.name !== "anikeaty08").slice(0, 5).map((x) => ({ name: x.name, pushedAt: x.pushed_at, language: x.language })),
      pushesThisWeek: null,
      activeRepos: repos.filter((x) => !x.fork && Date.parse(x.pushed_at) > Date.now() - 30 * 86400000).length,
    };
  } catch {
    return null;
  }
}

export function ago(iso: string) {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

function draw(ctx: CanvasRenderingContext2D, W: number, H: number, pulse: Pulse | null) {
  ctx.fillStyle = "#10131a";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#22c55e";
  ctx.beginPath();
  ctx.arc(58, 70, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#eaf6ff";
  ctx.font = "800 58px Syne, 'Arial Black', sans-serif";
  ctx.fillText("NOW SHIPPING", 92, 90);
  ctx.fillStyle = "#9fb3c8";
  ctx.font = "500 26px 'JetBrains Mono', monospace";
  ctx.fillText(pulse ? `live from GitHub · updated ${ago(pulse.updated)}` : "connecting to GitHub…", 94, 132);

  if (!pulse) return;
  const stats = [
    pulse.pushesThisWeek !== null && [`${pulse.pushesThisWeek}`, "pushes this week"],
    pulse.activeRepos !== null && [`${pulse.activeRepos}`, "repos active / 30 days"],
  ].filter(Boolean) as [string, string][];
  stats.forEach(([v, k], i) => {
    const x = 60 + i * 480;
    ctx.fillStyle = "#fbbf24";
    ctx.font = "800 64px Syne, 'Arial Black', sans-serif";
    ctx.fillText(v, x, 230);
    ctx.fillStyle = "#9fb3c8";
    ctx.font = "500 24px 'JetBrains Mono', monospace";
    ctx.fillText(k, x, 266);
  });

  const top = stats.length ? 330 : 200;
  ctx.fillStyle = "#6b7a90";
  ctx.font = "600 22px 'JetBrains Mono', monospace";
  ctx.fillText("LATEST PUSHES", 60, top);
  pulse.repos.slice(0, stats.length ? 4 : 6).forEach((r, i) => {
    const y = top + 50 + i * 52;
    ctx.fillStyle = "#eaf6ff";
    ctx.font = "700 34px Inter, sans-serif";
    ctx.fillText(r.name, 60, y);
    ctx.fillStyle = "#22d3ee";
    ctx.font = "500 26px 'JetBrains Mono', monospace";
    const meta = `${r.language ?? ""}${r.language ? " · " : ""}${ago(r.pushedAt)}`;
    ctx.fillText(meta, W - 60 - ctx.measureText(meta).width, y);
  });
}

/** The island's live board: a canvas texture on the screen of the frame modeled in Blender. */
export function LiveBoard({ data }: { data: WorldData }) {
  const b = data.liveBoard;
  const { canvas, texture } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1120;
    canvas.height = Math.round((1120 * b.h) / b.w);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return { canvas, texture };
  }, [b]);

  useEffect(() => {
    const ctx = canvas.getContext("2d")!;
    let alive = true;
    let pulse: Pulse | null = null;
    const paint = () => {
      draw(ctx, canvas.width, canvas.height, pulse);
      texture.needsUpdate = true;
    };
    paint();
    const refresh = () =>
      loadPulse().then((p) => {
        if (!alive) return;
        pulse = p;
        paint();
      });
    void refresh();
    document.fonts?.ready.then(paint, () => undefined);
    const timer = setInterval(refresh, 10 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [canvas, texture]);

  return (
    <mesh position={b.pos} rotation={[0, b.rotY, 0]}>
      <planeGeometry args={[b.w, b.h]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}
