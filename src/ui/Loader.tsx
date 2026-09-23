import { useProgress } from "@react-three/drei";
import { useEffect, useState } from "react";
import { setSound } from "../audio";
import { person } from "../content";
import { setState, useStore } from "../store";

export function Loader() {
  const { progress, active } = useProgress();
  const started = useStore((s) => s.started);
  const [ready, setReady] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (progress >= 100 && !active) {
      const t = setTimeout(() => setReady(true), 300);
      return () => clearTimeout(t);
    }
  }, [progress, active]);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 15000); // never trap anyone behind a stuck loader
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!started) return;
    const t = setTimeout(() => setGone(true), 900);
    return () => clearTimeout(t);
  }, [started]);

  if (gone) return null;

  const start = (sound: boolean) => {
    setState({ started: true, sound });
    if (sound) void setSound(true);
  };

  return (
    <div className={`loader ${started ? "loader--out" : ""}`}>
      <div className="loader__card">
        <span className="brand__mark brand__mark--big" aria-hidden>
          AY
        </span>
        <h1>{person.name}</h1>
        <p className="muted">{person.role} — and this is my island.</p>
        <div className="loader__bar" aria-hidden>
          <div style={{ transform: `scaleX(${progress / 100})` }} />
        </div>
        <div className="loader__actions">
          <button className="btn btn--primary" disabled={!ready} onClick={() => start(true)}>
            {ready ? "Start the engine" : `Loading ${Math.round(progress)}%`}
          </button>
          <button className="btn" disabled={!ready} onClick={() => start(false)}>
            Drive silently
          </button>
        </div>
        <button className="linkish" onClick={() => setState({ started: true, classic: true })}>
          No time? Open the classic site →
        </button>
      </div>
    </div>
  );
}
