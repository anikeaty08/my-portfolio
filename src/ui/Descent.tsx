import { useRef } from "react";
import { person } from "../content";
import { fallRadius, fallSpeed, milestones, timeDilation } from "../descent";
import { scroll } from "../scroll";
import { useStore } from "../store";
import { smoothstep, useLoop, window01 } from "./useLoop";

export function Descent() {
  const entered = useStore((s) => s.entered);
  const intro = useRef<HTMLDivElement>(null);
  const cue = useRef<HTMLDivElement>(null);
  const hud = useRef<HTMLDivElement>(null);
  const r = useRef<HTMLSpanElement>(null);
  const td = useRef<HTMLSpanElement>(null);
  const v = useRef<HTMLSpanElement>(null);
  const z = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const captions = useRef<(HTMLDivElement | null)[]>([]);
  const flash = useRef<HTMLDivElement>(null);
  const lastDive = useRef(0);

  useLoop(() => {
    const d = scroll.dive;
    const fadeIntro = 1 - smoothstep(d, 0.0, 0.08);
    if (intro.current) {
      intro.current.style.opacity = String(fadeIntro);
      intro.current.style.transform = `translate3d(0, ${-d * 300}px, 0)`;
    }
    if (cue.current) cue.current.style.opacity = String(1 - smoothstep(d, 0, 0.03));

    const radius = fallRadius(d);
    const dil = timeDilation(radius);
    if (r.current) r.current.textContent = radius <= 1 ? "< 1.00" : radius.toFixed(2);
    if (td.current) td.current.textContent = Number.isFinite(dil) ? `×${dil.toFixed(3)}` : "×∞";
    if (v.current) v.current.textContent = `${fallSpeed(radius).toFixed(3)}c`;
    if (z.current) z.current.textContent = Number.isFinite(dil) ? (dil - 1).toFixed(3) : "∞";
    if (bar.current) bar.current.style.transform = `scaleX(${d})`;
    if (hud.current) hud.current.style.opacity = String(smoothstep(d, 0.02, 0.08) * (1 - smoothstep(d, 0.97, 0.995)));

    captions.current.forEach((el, i) => {
      if (!el) return;
      const m = milestones[i];
      const o = window01(d, m.from, m.to, 0.035);
      el.style.opacity = String(o);
      el.style.transform = `translate3d(0, ${(1 - o) * 24}px, 0)`;
      el.style.filter = `blur(${(1 - o) * 8}px)`;
    });

    // A white flash the moment you cross the horizon on the way down.
    if (lastDive.current < 0.972 && d >= 0.972 && flash.current) {
      flash.current.classList.remove("flash--go");
      void flash.current.offsetWidth;
      flash.current.classList.add("flash--go");
    }
    lastDive.current = d;
  });

  return (
    <section id="descent" className="descent" aria-label="Introduction">
      <div className="descent__sticky">
        <h1 className="sr-only">
          {person.name} — {person.role}
        </h1>

        <div className={`hero ${entered ? "is-in" : ""}`} ref={intro}>
          <p className="mono hero__eyebrow">
            <span className="dot" /> {person.role} · {person.location}
          </p>
          <p className="hero__tagline">{person.tagline}</p>
          <p className="mono hero__meta">
            {person.education} · {person.status}
          </p>
        </div>

        <div className={`cue ${entered ? "is-in" : ""}`} ref={cue}>
          <span className="mono">Scroll to fall in</span>
          <span className="cue__line" />
        </div>

        <div className="hud mono" ref={hud} aria-hidden>
          <div>
            <span className="hud__k">Radius</span>
            <span ref={r} className="hud__v" /> <span className="hud__u">rₛ</span>
          </div>
          <div>
            <span className="hud__k">Time dilation</span>
            <span ref={td} className="hud__v" />
          </div>
          <div>
            <span className="hud__k">Infall velocity</span>
            <span ref={v} className="hud__v" />
          </div>
          <div>
            <span className="hud__k">Redshift z</span>
            <span ref={z} className="hud__v" />
          </div>
          <div className="hud__bar">
            <div ref={bar} />
          </div>
        </div>

        <div className="captions">
          {milestones.map((m, i) => (
            <div
              key={m.label}
              className="caption"
              ref={(el) => {
                captions.current[i] = el;
              }}
            >
              <p className="mono caption__label">{m.label}</p>
              <p className="caption__body">{m.body}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flash" ref={flash} aria-hidden />
    </section>
  );
}
