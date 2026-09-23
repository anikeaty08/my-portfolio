import { useEffect, useRef } from "react";

/** Runs `fn` every animation frame without re-rendering; for DOM styles driven by scroll. */
export function useLoop(fn: (t: number) => void) {
  const saved = useRef(fn);
  saved.current = fn;
  useEffect(() => {
    let raf = 0;
    const tick = (t: number) => {
      saved.current(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
}

export const smoothstep = (x: number, a: number, b: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** 0 outside [from, to], fading in and out over `edge` at both ends. */
export const window01 = (x: number, from: number, to: number, edge = 0.04) =>
  smoothstep(x, from, from + edge) * (1 - smoothstep(x, to - edge, to));
