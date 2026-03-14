import { resumeLinks, resumeSnapshot } from "../content";
import { Reveal } from "./Reveal";
import styles from "./Resume.module.css";

export function Resume() {
  return (
    <section className={styles.section} id="resume" aria-label="Resume">
      <Reveal>
        <div className={styles.head}>
          <h2 className={styles.title}>Resume</h2>
          <p className={styles.sub}>
            One-page snapshot, plus a printable version. Last updated {resumeSnapshot.lastUpdated}.
          </p>
          <div className={styles.actions}>
            <a className={styles.primary} href={resumeLinks.html} target="_blank" rel="noreferrer">
              Open printable
            </a>
            <a className={styles.secondary} href={resumeLinks.pdf} download>
              Download PDF
            </a>
          </div>
        </div>
      </Reveal>

      <div className={styles.grid}>
        <Reveal>
          <div className={styles.card}>
            <div className={styles.cardTop}>
              <h3 className={styles.h3}>Contact</h3>
              <div className={styles.mini}>
                Email:{" "}
                <a className={styles.link} href={`mailto:${resumeSnapshot.contact.email}`}>
                  {resumeSnapshot.contact.email}
                </a>
              </div>
              <div className={styles.mini}>
                GitHub:{" "}
                <a className={styles.link} href="https://github.com/anikeaty08" target="_blank" rel="noreferrer">
                  {resumeSnapshot.contact.githubLabel}
                </a>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div className={styles.card}>
            <h3 className={styles.h3}>Skills (Quick)</h3>
            <div className={styles.chips} aria-label="Resume skills">
              {resumeSnapshot.skillChips.map((c) => (
                <span className={styles.chip} key={c}>
                  {c}
                </span>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div className={styles.card}>
            <h3 className={styles.h3}>Highlights</h3>
            <ul className={styles.list}>
              {resumeSnapshot.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
