import { setState } from "../store";
import { telemetry } from "./controls";
import { plan } from "./planner";
import type { WorldData } from "./World";

/** Live autopilot state. The driver component writes `command`; the car reads it while `active`. */
export const autopilot = {
  active: false,
  path: [] as [number, number][],
  index: 0,
  zone: "",
  label: "",
  command: { throttle: 0, steer: 0, brake: false },
};

type Step = { text: string; state: "done" | "doing" | "fail" };
let steps: Step[] = [];

/** Pushes a trace line to the HUD. `update` rewrites the current (last) line instead. */
export function trace(text: string, state: Step["state"] = "doing", update = false) {
  if (update && steps.length) steps[steps.length - 1] = { text, state };
  else {
    steps = steps.map((s) => (s.state === "doing" ? { ...s, state: "done" } : s));
    steps.push({ text, state });
  }
  steps = steps.slice(-6);
  setState({ pilot: { active: autopilot.active, steps } });
}

export function stopAutopilot(reason?: string) {
  if (!autopilot.active) return;
  autopilot.active = false;
  autopilot.command = { throttle: 0, steer: 0, brake: false };
  if (reason) trace(reason, "done");
  else setState({ pilot: { active: false, steps } });
}

/** A* over the road graph. Returns node indices from start to goal, or null. */
function astar(nodes: [number, number][], adj: number[][], start: number, goal: number) {
  const h = (i: number) => Math.hypot(nodes[i][0] - nodes[goal][0], nodes[i][1] - nodes[goal][1]);
  const g = new Map<number, number>([[start, 0]]);
  const came = new Map<number, number>();
  const open = new Set([start]);
  const f = new Map<number, number>([[start, h(start)]]);
  while (open.size) {
    let cur = -1;
    for (const n of open) if (cur < 0 || (f.get(n) ?? Infinity) < (f.get(cur) ?? Infinity)) cur = n;
    if (cur === goal) {
      const out = [cur];
      while (came.has(out[0])) out.unshift(came.get(out[0])!);
      return out;
    }
    open.delete(cur);
    for (const nb of adj[cur]) {
      const cost = (g.get(cur) ?? Infinity) + Math.hypot(nodes[cur][0] - nodes[nb][0], nodes[cur][1] - nodes[nb][1]);
      if (cost < (g.get(nb) ?? Infinity)) {
        came.set(nb, cur);
        g.set(nb, cost);
        f.set(nb, cost + h(nb));
        open.add(nb);
      }
    }
  }
  return null;
}

/** Understand the request, plan a route on the roads, and hand over to the driver. */
export function engage(query: string, data: WorldData) {
  steps = [];
  autopilot.active = false;
  trace(`“${query}”`, "done");
  const intent = plan(query);
  if (!intent) {
    trace("Couldn't match that to anything on the island — try a project, skill or place", "fail");
    return;
  }
  trace(`Goal: ${intent.dest.label}${intent.matched.length ? ` (matched ${intent.matched.join(", ")})` : ""}`, "done");

  const { nodes, edges, zoneNodes } = data.roadGraph;
  const goal = zoneNodes[intent.dest.zone];
  if (goal === undefined) {
    trace("That place has no road to it yet", "fail");
    return;
  }
  const adj: number[][] = nodes.map(() => []);
  for (const [a, b] of edges) {
    adj[a].push(b);
    adj[b].push(a);
  }
  // Start from the nearest road node that's roughly ahead of us, so we don't U-turn for no reason.
  const fx = Math.cos(telemetry.heading);
  const fz = -Math.sin(telemetry.heading);
  let start = 0;
  let bestScore = Infinity;
  nodes.forEach(([x, z], i) => {
    const dx = x - telemetry.x;
    const dz = z - telemetry.z;
    const d = Math.hypot(dx, dz);
    const behind = d > 0.1 && (dx * fx + dz * fz) / d < -0.3 ? 8 : 0;
    if (d + behind < bestScore) {
      bestScore = d + behind;
      start = i;
    }
  });
  const route = astar(nodes, adj, start, goal);
  if (!route) {
    trace("No route found", "fail");
    return;
  }
  // Densify long edges so the pursuit controller always has a nearby target.
  const path: [number, number][] = [];
  route.forEach((n, i) => {
    const [x, z] = nodes[n];
    if (i > 0) {
      const [px, pz] = nodes[route[i - 1]];
      const len = Math.hypot(x - px, z - pz);
      const parts = Math.max(1, Math.floor(len / 3));
      for (let k = 1; k < parts; k++) path.push([px + ((x - px) * k) / parts, pz + ((z - pz) * k) / parts]);
    }
    path.push([x, z]);
  });
  const length = path.reduce((acc, p, i) => (i ? acc + Math.hypot(p[0] - path[i - 1][0], p[1] - path[i - 1][1]) : 0), 0);
  Object.assign(autopilot, { active: true, path, index: 0, zone: intent.dest.zone, label: intent.dest.label });
  trace(`Route planned: ${route.length} road nodes · ${Math.round(length)} m`, "done");
  trace("Driving", "doing");
}
