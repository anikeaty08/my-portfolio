/** Device-dependent quality knobs. "Lite" mode is remembered after the GPU gives up once. */
const coarse = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
const small = typeof window !== "undefined" && Math.min(window.innerWidth, window.innerHeight) < 700;

function readLite() {
  try {
    return new URLSearchParams(window.location.search).has("lite") || localStorage.getItem("gfx") === "lite";
  } catch {
    return false;
  }
}

const lite = typeof window !== "undefined" && readLite();

export const quality = {
  touch: coarse,
  mobile: coarse || small,
  lite,
  shadows: !lite,
  shadowMap: coarse || small ? 1024 : 2048,
  maxDpr: lite ? 1 : coarse || small ? 1.5 : 2,
  antialias: !lite,
};

/** Reload into lite graphics (no shadows, 1x resolution). */
export function retryLite() {
  try {
    localStorage.setItem("gfx", "lite");
  } catch {
    /* private mode: the ?lite flag below still works */
  }
  window.location.href = `${window.location.pathname}?lite`;
}
