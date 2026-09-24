/**
 * Device capability probe + quality knobs, decided once at load.
 * "Lite" (no shadows, 1x resolution, less grass) is used for software renderers and weak devices,
 * and remembered after the GPU gives up once.
 */
const hasWindow = typeof window !== "undefined";
const coarse = hasWindow && window.matchMedia("(pointer: coarse)").matches;
const small = hasWindow && Math.min(window.innerWidth, window.innerHeight) < 700;

function probe() {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return { webgl2: false, software: false };
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return { webgl2: true, software: /swiftshader|llvmpipe|software|basic render|microsoft basic/i.test(renderer) };
  } catch {
    return { webgl2: false, software: false };
  }
}

function remembered() {
  try {
    return new URLSearchParams(window.location.search).has("lite") || localStorage.getItem("gfx") === "lite";
  } catch {
    return false;
  }
}

const gpu = hasWindow ? probe() : { webgl2: false, software: false };
const nav = hasWindow ? (navigator as Navigator & { deviceMemory?: number }) : undefined;
const weak = (nav?.hardwareConcurrency ?? 8) <= 2 || (nav?.deviceMemory ?? 8) <= 2;
const lite = hasWindow && (remembered() || gpu.software || weak);

export const quality = {
  /** three.js needs WebGL2; without it we show the classic site. */
  webgl2: gpu.webgl2,
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
