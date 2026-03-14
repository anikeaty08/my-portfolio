import type { Project } from "../content";
import { Reveal } from "./Reveal";
import styles from "./Projects.module.css";

export function Projects(props: { projects: Project[]; onOpenCaseStudy: (slug: string) => void }) {
  return (
    <section className={styles.section} id="work" aria-label="Featured projects">
      <Reveal>
        <div className={styles.head}>
          <h2 className={styles.title}>Featured Projects</h2>
          <p className={styles.sub}>
            Selected work across Web3, agentic AI, and systems—built for real constraints and demo-ready polish.
          </p>
        </div>
      </Reveal>

      <div className={styles.grid}>
        {props.projects.map((p) => (
          <Reveal key={p.slug} className={styles.cardReveal}>
            <article className={styles.card}>
              <button
                type="button"
                className={styles.openOverlay}
                aria-label={`Open case study: ${p.title}`}
                onClick={() => props.onOpenCaseStudy(p.slug)}
              />

              <div className={styles.content}>
                <div className={styles.cardTop}>
                  <h3 className={styles.cardTitle}>{p.title}</h3>
                  <p className={styles.metric}>{p.impactMetric}</p>
                </div>

                <p className={styles.oneLiner}>{p.oneLiner}</p>

                <div className={styles.meta}>
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Role</span>
                    <span className={styles.metaValue}>{p.role}</span>
                  </div>
                </div>

                <div className={styles.tags} aria-label="Tech tags">
                  {p.tech.map((t) => (
                    <span key={t} className={styles.tag}>
                      {t}
                    </span>
                  ))}
                </div>

                <div className={styles.links} aria-label="Project links">
                  {p.links.live ? (
                    <a className={styles.link} href={p.links.live} target="_blank" rel="noreferrer">
                      Live
                    </a>
                  ) : null}
                  {p.links.github ? (
                    <a className={styles.link} href={p.links.github} target="_blank" rel="noreferrer">
                      GitHub
                    </a>
                  ) : null}
                  <button type="button" className={styles.caseButton} onClick={() => props.onOpenCaseStudy(p.slug)}>
                    Case study
                  </button>
                </div>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
