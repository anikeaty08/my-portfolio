import { useProgress } from "@react-three/drei";
import { useEffect, useState } from "react";
import { setSound } from "../audio";
import { setState, useStore } from "../store";

export function Loader() {
  const { progress, active } = useProgress();
  const entered = useStore((s) => s.entered);
  const [ready, setReady] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (progress >= 100 && !active) {
      const t = setTimeout(() => setReady(true), 400);
      return () => clearTimeout(t);
    }
  }, [progress, active]);

  // Never trap anyone behind a stuck loader.
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 12000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!entered) return;
    const t = setTimeout(() => setGone(true), 1600);
    return () => clearTimeout(t);
  }, [entered]);

  if (gone) return null;

  const enter = (sound: boolean) => {
    setState({ entered: true, sound });
    if (sound) void setSound(true);
  };

  return (
    <div className={`loader ${entered ? "loader--out" : ""}`} aria-live="polite">
      <div className="loader__disk" aria-hidden>
        <span />
      </div>
      <p className="mono loader__label">{ready ? "Singularity stable" : "Gravitational collapse"}</p>
      <p className="loader__pct">{Math.round(progress).toString().padStart(3, "0")}</p>
      <div className={`loader__actions ${ready ? "is-ready" : ""}`}>
        <button className="btn btn--solid" onClick={() => enter(true)} disabled={!ready}>
          Enter with sound
        </button>
        <button className="btn" onClick={() => enter(false)} disabled={!ready}>
          Enter silently
        </button>
      </div>
      <p className="mono loader__hint">Best on desktop · headphones recommended</p>
    </div>
  );
}
