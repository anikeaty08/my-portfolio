import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { initScroll, lockScroll } from "./scroll";
import { setState, useStore } from "./store";
import { Cursor } from "./ui/Cursor";
import { Descent } from "./ui/Descent";
import { Loader } from "./ui/Loader";
import { Nav } from "./ui/Nav";
import { Outro } from "./ui/Outro";
import { ProjectPanel, Work } from "./ui/Work";

const Scene = lazy(() => import("./three/Scene").then((m) => ({ default: m.Scene })));

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function App() {
  const entered = useStore((s) => s.entered);
  const reducedMotion = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const [webgl, setWebgl] = useState(hasWebGL);

  useEffect(() => initScroll(reducedMotion), [reducedMotion]);

  useEffect(() => {
    lockScroll(!entered);
    if (entered) return;
    // ?enter skips the loader, ?y=<px> jumps to a scroll position (handy for screenshots).
    const q = new URLSearchParams(window.location.search);
    if (q.has("enter") || !webgl) setState({ entered: true });
  }, [entered, webgl]);

  useEffect(() => {
    if (!entered) return;
    const y = Number(new URLSearchParams(window.location.search).get("y"));
    if (y) window.scrollTo(0, y);
  }, [entered]);

  return (
    <div className={`app ${webgl ? "" : "no-gl"}`}>
      {webgl && (
        <Suspense fallback={null}>
          <Scene
            reducedMotion={reducedMotion}
            onLost={() => {
              setWebgl(false);
              setState({ entered: true, active: null });
            }}
          />
        </Suspense>
      )}
      {webgl && <Loader />}
      <Cursor />
      <Nav />
      <main>
        <Descent />
        <Work />
        <Outro />
      </main>
      <ProjectPanel />
    </div>
  );
}
