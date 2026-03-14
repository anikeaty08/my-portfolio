import type { ExperienceItem } from "../content";
import { Reveal } from "./Reveal";
import styles from "./Experience.module.css";

export function Experience(props: { items: ExperienceItem[] }) {
  return (
    <section className={styles.section} id="experience" aria-label="Experience">
      <Reveal>
        <div className={styles.head}>
          <h2 className={styles.title}>Experience</h2>
          <p className={styles.sub}>Projects shipped and systems explored—with clear scope and measurable details.</p>
        </div>
      </Reveal>

      <ol className={styles.timeline}>
        {props.items.map((it) => (
          <Reveal key={`${it.company}-${it.role}`}>
            <li className={styles.item}>
              <div className={styles.rail} aria-hidden="true">
                <span className={styles.dot} />
              </div>
              <div className={styles.card}>
                <div className={styles.top}>
                  <div className={styles.company}>{it.company}</div>
                  <div className={styles.dates}>{it.dates}</div>
                </div>
                <div className={styles.role}>{it.role}</div>
                <ul className={styles.achievements}>
                  {it.achievements.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            </li>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
