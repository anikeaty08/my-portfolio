import Lenis from "lenis";

/**
 * Scroll progress shared between the DOM and the WebGL scene. Mutated every frame and
 * read inside useFrame, so the 3D never waits on a React render.
 *
 *  dive  0→1  hero + descent: camera falls from orbit through the event horizon
 *  work  0→1  the portal corridor, one project per viewport
 *  outro 0→1  about → contact
 */
export const scroll = {
  y: 0,
  dive: 0,
  work: 0,
  outro: 0,
  velocity: 0,
  /** Pointer in NDC (-1..1), smoothed. */
  mx: 0,
  my: 0,
  /** Raw pointer in 0..1 page UV (y up), for the cursor lens. */
  px: 0.5,
  py: 0.5,
};

let lenis: Lenis | null = null;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function span(id: string) {
  const el = document.getElementById(id);
  if (!el) return null;
  const top = el.offsetTop;
  return { top, height: el.offsetHeight };
}

function measure(y: number) {
  const vh = window.innerHeight;
  const descent = span("descent");
  const work = span("work");
  const outro = span("outro");
  if (descent) scroll.dive = clamp01((y - descent.top) / Math.max(1, descent.height - vh));
  if (work) scroll.work = clamp01((y - work.top) / Math.max(1, work.height - vh));
  if (outro) scroll.outro = clamp01((y - outro.top + vh) / Math.max(1, outro.height));
  scroll.y = y;
}

export function initScroll(reducedMotion: boolean) {
  lenis = new Lenis({ lerp: reducedMotion ? 1 : 0.085, smoothWheel: !reducedMotion });
  lenis.on("scroll", (l: Lenis) => {
    scroll.velocity = l.velocity;
    measure(l.scroll);
  });

  const onMove = (e: PointerEvent) => {
    scroll.px = e.clientX / window.innerWidth;
    scroll.py = 1 - e.clientY / window.innerHeight;
  };
  window.addEventListener("pointermove", onMove);

  let raf = 0;
  const tick = (t: number) => {
    lenis?.raf(t);
    const tx = scroll.px * 2 - 1;
    const ty = scroll.py * 2 - 1;
    scroll.mx += (tx - scroll.mx) * 0.06;
    scroll.my += (ty - scroll.my) * 0.06;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  const onResize = () => measure(window.scrollY);
  window.addEventListener("resize", onResize);
  measure(window.scrollY);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("resize", onResize);
    lenis?.destroy();
    lenis = null;
  };
}

export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { duration: 2.2 });
  else el.scrollIntoView({ behavior: "smooth" });
}

export function lockScroll(locked: boolean) {
  if (locked) lenis?.stop();
  else lenis?.start();
  document.documentElement.style.overflow = locked ? "hidden" : "";
}
