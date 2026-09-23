import { useSyncExternalStore } from "react";

export type ZoneId = string; // "project:<slug>" | "about" | "skills" | "contact" | "lighthouse"

/** Tiny UI store shared by the HTML overlay and the 3D scene. */
type State = {
  started: boolean;
  classic: boolean;
  /** Why the classic site is showing when the visitor didn't choose it. */
  fallback: null | "no-webgl" | "gpu-lost";
  /** Zone pad the car is currently parked on. */
  zone: ZoneId | null;
  /** Zone whose panel is open. */
  panel: ZoneId | null;
  night: boolean;
  sound: boolean;
  /** Bumped to request a car reset. */
  resetTick: number;
  /** Teleport request: zone id to drive to. */
  teleport: { key: number; zone: string } | null;
  toast: { key: number; title: string; body: string } | null;
  achievements: number;
  eggs: number;
  skin: string;
  /** Konami easter egg: low gravity. */
  moon: boolean;
  /** Achievements drawer open. */
  trophies: boolean;
};

let state: State = {
  started: false,
  classic: false,
  fallback: null,
  zone: null,
  panel: null,
  night: false,
  sound: false,
  resetTick: 0,
  teleport: null,
  toast: null,
  achievements: 0,
  eggs: 0,
  skin: "orange",
  moon: false,
  trophies: false,
};
const listeners = new Set<() => void>();

export function setState(patch: Partial<State>) {
  const next = { ...state, ...patch };
  if ((Object.keys(patch) as (keyof State)[]).every((k) => next[k] === state[k])) return;
  state = next;
  listeners.forEach((l) => l());
}

export function getState() {
  return state;
}

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => select(state),
  );
}
