/** Device-dependent quality knobs, adjusted at runtime by the PerformanceMonitor. */
const coarse = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
const small = typeof window !== "undefined" && Math.min(window.innerWidth, window.innerHeight) < 700;

export const quality = {
  pointerFine: !coarse,
  mobile: coarse || small,
  /** Max geodesic integration steps per pixel for the black hole. */
  steps: coarse || small ? 110 : 180,
  /** Black hole render resolution relative to the canvas. */
  traceScale: coarse || small ? 0.45 : 0.6,
  maxDpr: coarse || small ? 1.25 : 1.5,
};

/** Called when frame rate drops: cheapen the ray tracer first, it dominates GPU time. */
export function degrade() {
  quality.traceScale = Math.max(0.3, +(quality.traceScale - 0.1).toFixed(2));
  quality.steps = Math.max(90, quality.steps - 30);
}
