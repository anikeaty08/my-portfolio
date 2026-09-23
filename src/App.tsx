import { lazy, Suspense, useEffect, useState } from "react";
import { setSound } from "./audio";
import { bindKeyboard, input } from "./game/controls";
import type { WorldData } from "./game/World";
import { getState, setState, useStore } from "./store";
import { Classic } from "./ui/Classic";
import { Hud } from "./ui/Hud";
import { Loader } from "./ui/Loader";
import { Panel } from "./ui/Panels";

const Game = lazy(() => import("./game/Game").then((m) => ({ default: m.Game })));

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(gl);
  } catch {
    return false;
  }
}

export default function App() {
  const classic = useStore((s) => s.classic);
  const started = useStore((s) => s.started);
  const [webgl, setWebgl] = useState(hasWebGL);
  const [data, setData] = useState<WorldData | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (!webgl || q.has("classic")) setState({ started: true, classic: true });
    else if (q.has("start")) setState({ started: true });
    // Dev-only: ?autodrive=<throttle>,<steer> holds the controls, for testing handling in a headless browser.
    if (import.meta.env.DEV && q.has("autodrive")) {
      const [t, s] = (q.get("autodrive") || "1,0").split(",").map(Number);
      Object.assign(input, { throttle: t, steer: s || 0 });
    }
    if (import.meta.env.DEV && q.get("panel")) setState({ panel: q.get("panel") });
    if (import.meta.env.DEV && q.has("night")) setState({ night: true });
  }, [webgl]);

  useEffect(() => {
    fetch("/world/world.json")
      .then((r) => r.json())
      .then(setData)
      .catch(() => undefined);
  }, []);

  useEffect(
    () =>
      bindKeyboard((code) => {
        const s = getState();
        if (!s.started || s.classic) return;
        if (code === "Enter" && s.zone && !s.panel) setState({ panel: s.zone });
        else if (code === "Escape") setState({ panel: null });
        else if (code === "KeyR") setState({ resetTick: s.resetTick + 1 });
        else if (code === "KeyN") setState({ night: !s.night });
        else if (code === "KeyM") {
          setState({ sound: !s.sound });
          void setSound(!s.sound);
        }
      }),
    [],
  );

  return (
    <>
      {webgl && (
        <Suspense fallback={null}>
          <Game
            onLost={() => {
              setWebgl(false);
              setState({ started: true, classic: true });
            }}
          />
        </Suspense>
      )}
      {webgl && !classic && started && (
        <>
          <Hud data={data} />
          <Panel />
        </>
      )}
      {webgl && <Loader />}
      {classic && <Classic canDrive={webgl} />}
    </>
  );
}
