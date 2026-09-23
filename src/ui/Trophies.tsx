import { useEffect, useRef, useState } from "react";
import { ACHIEVEMENTS, SKINS, isUnlocked, progress, setSkin, unlockedCount } from "../game/achievements";
import { race } from "../game/race";
import { setState, useStore } from "../store";
import { Lock, Trophy } from "./icons";

/** Pops up whenever something is unlocked (or a lap / bowling result comes in). */
export function Toast() {
  const toast = useStore((s) => s.toast);
  const [shown, setShown] = useState(toast);
  useEffect(() => {
    if (!toast) return;
    setShown(toast);
    const t = setTimeout(() => setShown(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);
  if (!shown) return null;
  return (
    <div className="toast" key={shown.key} role="status">
      <strong>{shown.title}</strong>
      <span>{shown.body}</span>
    </div>
  );
}

function fmt(t: number | null) {
  return t === null ? "—" : `${t.toFixed(2)}s`;
}

/** Live lap time while a lap is in progress on the ring road. */
export function LapTimer() {
  const cur = useRef<HTMLSpanElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const best = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (box.current) box.current.classList.toggle("is-live", race.running);
      if (cur.current) cur.current.textContent = race.running ? `${race.current.toFixed(2)}s` : "";
      if (best.current) best.current.textContent = fmt(race.best ?? progress.bestLap);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="laptimer" ref={box} aria-live="off">
      <span className="kicker">Lap</span>
      <span className="laptimer__cur" ref={cur} />
      <span className="laptimer__best">
        best <span ref={best} />
      </span>
    </div>
  );
}

/** Achievements list + the paint shop. */
export function Trophies() {
  const open = useStore((s) => s.trophies);
  const count = useStore((s) => s.achievements);
  const skin = useStore((s) => s.skin);
  const eggs = useStore((s) => s.eggs);
  useEffect(() => {
    setState({ achievements: unlockedCount(), eggs: progress.eggs.length, skin: progress.skin });
  }, []);

  return (
    <>
      <button className="trophy-btn" onClick={() => setState({ trophies: !open })} aria-expanded={open}>
        <Trophy /> <strong>{count}</strong>/{ACHIEVEMENTS.length}
      </button>
      {open && (
        <div className="trophies" role="dialog" aria-label="Achievements">
          <div className="panel__head">
            <p className="kicker">
              {count} of {ACHIEVEMENTS.length} · eggs {eggs}/3
            </p>
            <button className="icon-btn" onClick={() => setState({ trophies: false })} aria-label="Close">
              ✕
            </button>
          </div>
          <h2>Achievements</h2>
          <ul className="achievements">
            {ACHIEVEMENTS.map((a) => {
              const done = isUnlocked(a.id);
              return (
                <li key={a.id} className={done ? "is-done" : ""}>
                  <span className="achievements__dot" aria-hidden>
                    {done ? "✓" : ""}
                  </span>
                  <div>
                    <strong>{done ? a.title : "???"}</strong>
                    <span>{a.hint}</span>
                  </div>
                </li>
              );
            })}
          </ul>
          <h3>Paint shop</h3>
          <div className="skins">
            {SKINS.map((s) => {
              const locked = count < s.need;
              return (
                <button
                  key={s.id}
                  className={`skin ${skin === s.id ? "is-on" : ""}`}
                  disabled={locked}
                  onClick={() => setSkin(s.id)}
                  title={locked ? `Unlock ${s.need} achievements` : s.name}
                >
                  <span style={{ background: s.color }} />
                  {locked ? <><Lock /> {s.need}</> : s.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
