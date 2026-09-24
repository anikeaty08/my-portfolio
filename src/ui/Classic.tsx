import { about, person, projects, skills } from "../content";
import { retryLite } from "../game/quality";
import { setState, useStore } from "../store";
import { Chips, ContactBody, ExperienceList, ProjectLinks } from "./Panels";

const NAV = [
  { id: "work", label: "Work" },
  { id: "skills", label: "Skills" },
  { id: "about", label: "About" },
  { id: "contact", label: "Contact" },
];

function jump(id: string) {
  document.getElementById(`c-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** The whole portfolio as a normal page — for recruiters in a hurry and devices without WebGL2. */
export function Classic({ canDrive }: { canDrive: boolean }) {
  const fallback = useStore((s) => s.fallback);

  return (
    <div className="classic">
      <header className="c-nav">
        <button className="c-nav__brand" onClick={() => document.querySelector(".classic")?.scrollTo({ top: 0, behavior: "smooth" })}>
          <span className="brand__mark">AY</span>
          <span>{person.name}</span>
        </button>
        <nav aria-label="Sections">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => jump(n.id)}>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="c-nav__cta">
          <a className="btn btn--small" href="/resume.html" target="_blank" rel="noreferrer">
            Resume
          </a>
          {canDrive && (
            <button className="btn btn--small btn--primary" onClick={() => setState({ classic: false })}>
              Drive the island →
            </button>
          )}
        </div>
      </header>

      {!canDrive && (
        <div className="notice">
          <p>
            {fallback === "gpu-lost"
              ? "This site is a 3D island you drive around, but your graphics card gave up while drawing it."
              : "This site is a 3D island you drive around, but your browser has 3D (WebGL2) turned off or blocked. Fully close and reopen the browser to try again."}
          </p>
          <button className="btn btn--small btn--primary" onClick={retryLite}>
            Try 3D again (lighter)
          </button>
        </div>
      )}

      <section className="c-hero">
        <div className="c-hero__text">
          <p className="c-badge">
            <span className="dot" /> {person.status}
          </p>
          <h1>
            {person.name.split(" ")[0]}
            <br />
            <span>{person.name.split(" ").slice(1).join(" ")}</span>
          </h1>
          <p className="lead">{person.tagline}</p>
          <p className="muted">
            {person.role} · {person.location} · {person.education}
          </p>
          <div className="actions">
            <button className="btn btn--primary" onClick={() => jump("work")}>
              See my work
            </button>
            <a className="btn" href={person.github} target="_blank" rel="noreferrer">
              GitHub ↗
            </a>
          </div>
        </div>
        <figure className="c-hero__art">
          <img src="/world/hero.webp" alt="A low-poly island with a little orange car, modeled in Blender — the 3D version of this site" />
          {canDrive && (
            <button className="c-sticker" onClick={() => setState({ classic: false })}>
              <strong>Drive it</strong>
              <span>it's a real 3D world →</span>
            </button>
          )}
        </figure>
      </section>

      <dl className="c-stats">
        {about.facts.map((f) => (
          <div key={f.k}>
            <dd>{f.v}</dd>
            <dt>{f.k}</dt>
          </div>
        ))}
      </dl>

      <section id="c-work" className="c-section">
        <header className="c-section__head">
          <p className="kicker">Selected work</p>
          <h2>Featured projects</h2>
        </header>
        <div className="cards">
          {projects.map((p) => (
            <article key={p.slug} className="card" style={{ ["--accent" as string]: p.color }}>
              <img src={`/world/thumbs/${p.slug}.webp`} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.display = "none")} />
              <p className="kicker">{p.tagline}</p>
              <h3>{p.title}</h3>
              <p>{p.oneLiner}</p>
              <Chips items={p.tech} />
              <details className="card__more">
                <summary>Case study</summary>
                <p>{p.caseStudy.problem}</p>
                <ul className="ticks">
                  {p.caseStudy.approach.concat(p.caseStudy.results).map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </details>
              <ProjectLinks p={p} small />
            </article>
          ))}
        </div>
      </section>

      <section id="c-skills" className="c-section">
        <header className="c-section__head">
          <p className="kicker">Toolbox</p>
          <h2>Skills</h2>
        </header>
        <div className="c-skills">
          {skills.map((s) => (
            <div key={s.orbit} className="c-skill" style={{ ["--accent" as string]: s.color }}>
              <h3>{s.orbit}</h3>
              <Chips items={s.items} />
            </div>
          ))}
        </div>
      </section>

      <section id="c-about" className="c-section c-about">
        <header className="c-section__head">
          <p className="kicker">About</p>
          <h2>Hi, I'm {person.name.split(" ")[0]}.</h2>
        </header>
        <div className="c-about__grid">
          <div>
            <p className="lead">{about.lead}</p>
            <p>{about.body}</p>
          </div>
          <div className="c-card">
            <h3>Highlights</h3>
            <ul className="ticks">
              {about.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
            <h3>Experience</h3>
            <ExperienceList />
            <h3>Education</h3>
            <p>{person.education}</p>
          </div>
        </div>
      </section>

      <section id="c-contact" className="c-section">
        <header className="c-section__head">
          <p className="kicker">Contact</p>
          <h2>Let's build something</h2>
        </header>
        <div className="c-card c-contact">
          <ContactBody />
        </div>
      </section>

      <footer className="classic__footer">
        © {new Date().getFullYear()} {person.name} · Island modeled in Blender, driven with Three.js + Rapier
      </footer>
    </div>
  );
}
