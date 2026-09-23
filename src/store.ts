import { useSyncExternalStore } from "react";

/** Tiny UI store shared by the DOM overlay and the 3D scene. */
type State = {
  entered: boolean;
  /** Project whose world is open (camera flew through its portal). */
  active: number | null;
  /** Project centered in the corridor right now. */
  current: number;
  hovered: number | null;
  sound: boolean;
};

let state: State = { entered: false, active: null, current: 0, hovered: null, sound: false };
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
