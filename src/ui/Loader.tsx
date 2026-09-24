import { useProgress } from "@react-three/drei";
import { useEffect, useState } from "react";
import { setSound } from "../audio";
import { person } from "../content";
import { quality } from "../game/quality";
import { setState, useStore } from "../store";

/**
 * Opening screen. The backdrop is a Blender render taken from the same camera the 3D scene starts at,
 * so when it fades out the live island is already sitting underneath in the same framing.
 */
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
    const t = setTimeout(() => setGone(true), 1400);
    return () => clearTimeout(t);
  }, [started]);

  if (gone) return null;

  const start = (sound: boolean) => {
    setState({ started: true, sound });
    if (sound) void setSound(true);
  };

  return (
    <div className={`loader ${started ? "loader--out" : ""} ${ready ? "is-ready" : ""}`}>
      <div className="loader__backdrop" aria-hidden />
      <div className="loader__card">
        <p className="kicker">
          {person.role} · {person.location}
        </p>
        <h1>{person.name}</h1>
        <p className="loader__lead">Welcome to my island. Grab the wheel — every project, skill and secret is somewhere out there.</p>
        <div className="loader__bar" aria-hidden>
          <div style={{ transform: `scaleX(${progress / 100})` }} />
        </div>
        <div className="loader__actions">
          <button className="btn btn--primary btn--big" disabled={!ready} onClick={() => start(true)}>
            {ready ? "Start the engine" : `Building the island… ${Math.round(progress)}%`}
          </button>
          <button className="btn" disabled={!ready} onClick={() => start(false)}>
            Drive silently
          </button>
        </div>
        <p className="loader__foot">
          {quality.touch ? "Joystick to drive · tap the pads" : "WASD / arrows to drive · mouse drag to look around"}
          {" · "}
          <button className="linkish" onClick={() => setState({ started: true, classic: true })}>
            skip to the classic site
          </button>
        </p>
      </div>
    </div>
  );
}
