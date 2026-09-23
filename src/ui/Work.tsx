import { useEffect, useRef } from "react";
import { projects } from "../content";
import { lockScroll, scroll } from "../scroll";
import { setState, useStore } from "../store";
import { smoothstep, useLoop } from "./useLoop";

export function Work() {
  const current = useStore((s) => s.current);
  const active = useStore((s) => s.active);
  const wrap = useRef<HTMLDivElement>(null);
  const p = projects[current];
  const side = current % 2 === 0 ? "left" : "right";

  useLoop(() => {
    if (!wrap.current) return;
    const o = smoothstep(scroll.dive, 0.975, 1) * (1 - smoothstep(scroll.outro, 0.02, 0.14));
    wrap.current.style.opacity = String(active === null ? o : 0);
    wrap.current.style.pointerEvents = o > 0.5 && active === null ? "auto" : "none";
  });

  return (
    <section id="work" className="work" style={{ height: `${projects.length * 100 + 40}vh` }} aria-label="Selected work">
      <div className="work__sticky">
        <div className={`work__panel work__panel--${side}`} ref={wrap}>
          <p className="mono work__eyebrow">
            {current === 0 ? "You made it through · " : ""}World {String(current + 1).padStart(2, "0")} / {String(projects.length).padStart(2, "0")}
          </p>
          <div className="work__card" key={p.slug}>
            <h2 className="work__title" style={{ ["--accent" as string]: p.color }}>
              {p.title}
            </h2>
            <p className="work__tagline">{p.tagline}</p>
            <p className="work__line">{p.oneLiner}</p>
            <ul className="chips">
              {p.tech.map((t) => (
                <li key={t} className="mono">
                  {t}
                </li>
              ))}
            </ul>
            <div className="work__actions">
              <button className="btn btn--solid" style={{ ["--accent" as string]: p.color }} onClick={() => setState({ active: current })}>
                Step inside →
              </button>
              {p.links.live && (
                <a className="btn" href={p.links.live} target="_blank" rel="noreferrer">
                  Live ↗
                </a>
              )}
              {p.links.github && (
                <a className="btn" href={p.links.github} target="_blank" rel="noreferrer">
                  Code ↗
                </a>
              )}
            </div>
          </div>
          <div className="work__dots" aria-hidden>
            {projects.map((q, i) => (
              <span key={q.slug} className={i === current ? "is-on" : ""} style={{ ["--accent" as string]: q.color }} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ProjectPanel() {
  const active = useStore((s) => s.active);
  const p = active === null ? null : projects[active];

  useEffect(() => {
    lockScroll(active !== null);
    if (active === null) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setState({ active: null });
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  return (
    <aside className={`panel ${p ? "is-open" : ""}`} aria-hidden={!p} aria-label={p ? `${p.title} case study` : undefined}>
      {p && (
        <div className="panel__inner" key={p.slug} style={{ ["--accent" as string]: p.color }}>
          <button className="panel__close mono" onClick={() => setState({ active: null })}>
            ← Back to the corridor <kbd>Esc</kbd>
          </button>
          <p className="mono panel__eyebrow">{p.tagline}</p>
          <h2 className="panel__title">{p.title}</h2>
          <p className="panel__lead">{p.caseStudy.problem}</p>
          <div className="panel__cols">
            <div>
              <h3 className="mono">Approach</h3>
              <ul>
                {p.caseStudy.approach.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mono">Outcome</h3>
              <ul>
                {p.caseStudy.results.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          </div>
          <ul className="chips">
            {p.tech.map((t) => (
              <li key={t} className="mono">
                {t}
              </li>
            ))}
          </ul>
          <div className="work__actions">
            {p.links.live && (
              <a className="btn btn--solid" href={p.links.live} target="_blank" rel="noreferrer">
                Open live ↗
              </a>
            )}
            {p.links.github && (
              <a className="btn" href={p.links.github} target="_blank" rel="noreferrer">
                Source ↗
              </a>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
