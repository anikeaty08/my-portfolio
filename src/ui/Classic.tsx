import { person, projects } from "../content";
import { retryLite } from "../game/quality";
import { setState, useStore } from "../store";
import { AboutBody, Chips, ContactBody, SkillsBody } from "./Panels";

/** The whole portfolio as a normal page — for recruiters in a hurry and devices without WebGL. */
export function Classic({ canDrive }: { canDrive: boolean }) {
  const fallback = useStore((s) => s.fallback);
  return (
    <div className="classic">
      <header className="classic__top">
        <span className="brand__mark">AY</span>
        {canDrive ? (
          <button className="btn btn--primary" onClick={() => setState({ classic: false })}>
            ← Back to the island
          </button>
        ) : (
          <div className="notice">
            {fallback === "gpu-lost" ? (
              <p>
                This site is a 3D island you drive around, but your graphics card gave up while drawing it. The lighter
                version usually works.
              </p>
            ) : (
              <p>
                This site is a 3D island you drive around, but your browser says 3D (WebGL) is turned off or blocked.
                Fully close and reopen the browser, then try again.
              </p>
            )}
            <button className="btn btn--small btn--primary" onClick={retryLite}>
              Try 3D again (lighter)
            </button>
          </div>
        )}
      </header>

      <section className="classic__hero">
        <p className="kicker">
          {person.role} · {person.location}
        </p>
        <h1>{person.name}</h1>
        <p className="lead">{person.tagline}</p>
        <p className="muted">
          {person.education} · {person.status}
        </p>
      </section>

      <section>
        <h2>Projects</h2>
        <div className="cards">
          {projects.map((p) => (
            <article key={p.slug} className="card" style={{ ["--accent" as string]: p.color }}>
              <img src={`/world/thumbs/${p.slug}.webp`} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.display = "none")} />
              <p className="kicker">{p.tagline}</p>
              <h3>{p.title}</h3>
              <p>{p.oneLiner}</p>
              <Chips items={p.tech} />
              <div className="actions">
                {p.links.live && (
                  <a className="btn btn--small btn--primary" href={p.links.live} target="_blank" rel="noreferrer">
                    Live ↗
                  </a>
                )}
                {p.links.github && (
                  <a className="btn btn--small" href={p.links.github} target="_blank" rel="noreferrer">
                    Code ↗
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2>About</h2>
        <AboutBody />
      </section>

      <section>
        <h2>Skills</h2>
        <SkillsBody />
      </section>

      <section>
        <h2>Contact</h2>
        <ContactBody />
      </section>

      <footer className="classic__footer">
        © {new Date().getFullYear()} {person.name} · Island modeled in Blender, driven with Three.js + Rapier
      </footer>
    </div>
  );
}
