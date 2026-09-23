import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { getState, setState } from "../store";
import { collectEgg, recordLap, unlock } from "./achievements";
import { telemetry } from "./controls";
import { props, resetGroup, type WorldData } from "./World";

/** Live race state, read by the HUD every frame. */
export const race = { running: false, start: 0, current: 0, last: null as number | null, best: null as number | null, next: 1 };

const up = new THREE.Vector3();
const q = new THREE.Quaternion();

function displaced(group: string, dist: number) {
  let n = 0;
  let total = 0;
  for (const b of props) {
    if (b.group !== group) continue;
    total++;
    const p = b.rb.translation();
    if (Math.hypot(p.x - b.home.p.x, p.z - b.home.p.z) > dist || p.y < b.home.p.y - 0.4) n++;
  }
  return { n, total };
}

function pinsDown() {
  let down = 0;
  let moving = false;
  let ballMoved = false;
  for (const b of props) {
    if (b.group !== "pin" && b.group !== "ball") continue;
    const v = b.rb.linvel();
    if (Math.hypot(v.x, v.y, v.z) > 0.15) moving = true;
    if (b.group === "ball") {
      const p = b.rb.translation();
      ballMoved = Math.hypot(p.x - b.home.p.x, p.z - b.home.p.z) > 1;
      continue;
    }
    const r = b.rb.rotation();
    up.set(0, 1, 0).applyQuaternion(q.set(r.x, r.y, r.z, r.w));
    const p = b.rb.translation();
    if (up.y < 0.75 || Math.hypot(p.x - b.home.p.x, p.z - b.home.p.z) > 0.6) down++;
  }
  return { down, moving, ballMoved };
}

/**
 * Game rules that aren't physics: lap timing on the ring road, the bowling round,
 * "you smashed it" achievements, golden eggs and teleports.
 */
export function Gameplay({ data }: { data: WorldData }) {
  const checkpoints = useRef(data.zones.filter((z) => z.kind === "checkpoint").sort((a, b) => a.id.localeCompare(b.id)));
  const eggs = useRef(data.zones.filter((z) => z.kind === "egg"));
  const bowl = useRef({ phase: "idle" as "idle" | "rolling" | "settling", since: 0 });
  const slow = useRef(0);
  const wasAtFinish = useRef(true); // the car spawns on the line

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    const s = getState();
    if (!s.started) return;

    // ---------------------------------------------------------- lap timer
    // Leaving the start/finish zone starts the clock; re-entering it after cp:1 → cp:2 → cp:3 stops it.
    const inside = (z: { pos: number[]; radius: number }) => Math.hypot(telemetry.x - z.pos[0], telemetry.z - z.pos[2]) < z.radius;
    const cps = checkpoints.current;
    if (cps.length === 4) {
      const atFinish = inside(cps[0]);
      const entered = atFinish && !wasAtFinish.current;
      const left = !atFinish && wasAtFinish.current;
      wasAtFinish.current = atFinish;
      if (entered && race.running && race.next === 4) {
        const lap = now - race.start;
        race.last = lap;
        race.running = false;
        const best = recordLap(lap);
        race.best = best ? lap : race.best;
        setState({ toast: { key: Date.now(), title: `Lap: ${lap.toFixed(2)}s`, body: best ? "New personal best!" : `Best: ${race.best?.toFixed(2)}s` } });
      } else if (left) {
        race.running = true;
        race.start = now;
        race.next = 1;
      } else if (race.running && race.next < 4 && inside(cps[race.next])) {
        race.next++;
      }
      if (race.running) {
        race.current = now - race.start;
        if (race.current > 90) race.running = false; // wandered off; stop the clock
      }
    }

    // ---------------------------------------------------------- golden eggs
    eggs.current.forEach((z) => {
      if (inside(z)) collectEgg(Number(z.id.split(":")[1]));
    });

    // ---------------------------------------------------------- bowling: wait for everything to settle, count, reset
    const b = bowl.current;
    const { down, moving, ballMoved } = pinsDown();
    if (b.phase === "idle" && (down > 0 || ballMoved)) {
      b.phase = "rolling";
      b.since = now;
    } else if (b.phase === "rolling" && !moving && now - b.since > 1.5) {
      b.phase = "settling";
      b.since = now;
      if (down >= 10) unlock("strike");
      setState({
        toast: {
          key: Date.now(),
          title: down >= 10 ? "STRIKE! 🎳" : down === 0 ? "Gutter ball" : `${down} pin${down === 1 ? "" : "s"} down`,
          body: "Pins reset in a moment",
        },
      });
    } else if (b.phase === "settling" && now - b.since > 3) {
      resetGroup("pin");
      resetGroup("ball");
      b.phase = "idle";
    }

    // ---------------------------------------------------------- smash achievements (checked a few times a second)
    if (now - slow.current > 0.4) {
      slow.current = now;
      if (Math.abs(telemetry.speed) > 3) unlock("first-drive");
      if (displaced("letter", 1.5).n >= 4) unlock("vandal");
      const cones = displaced("cone", 1);
      if (cones.total && cones.n === cones.total) unlock("cones");
      if (displaced("crate", 1).n >= 4) unlock("crates");
      if (displaced("brick", 1).n >= 12) unlock("wall");
      if (displaced("block", 1).n >= 6) unlock("skills");
      if (s.night) unlock("night");
    }
  });

  return null;
}

/** Where to drop the car for a teleport: just in front of the zone, facing it. */
export function teleportTarget(data: WorldData, zoneId: string) {
  const z = data.zones.find((q) => q.id === zoneId);
  if (!z) return null;
  const [x, , zz] = z.pos;
  const toCenter = new THREE.Vector2(-x, -zz).normalize();
  const pos = new THREE.Vector3(x + toCenter.x * (z.radius + 3.5), data.ground + 1.2, zz + toCenter.y * (z.radius + 3.5));
  const heading = Math.atan2(-(zz - pos.z), x - pos.x); // yaw that points +X at the zone
  return { pos, rot: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading) };
}
