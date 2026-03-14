import { Reveal } from "./Reveal";
import styles from "./Hero.module.css";

export function Hero(props: {
  person: {
    name: string;
    kicker?: string;
    tagline: string;
    bioLine: string;
    location: string;
    stats: { label: string; value: string }[];
  };
  onViewWork: () => void;
  onContact: () => void;
}) {
  return (
    <section className={styles.hero} aria-label="Intro">
      <Reveal>
        <div className={styles.grid}>
          <div className={styles.left}>
            <p className={styles.kicker}>{props.person.kicker ?? "Software Developer / Designer"}</p>
            <h1 className={styles.title}>
              {props.person.name}
              <span className={styles.dot} aria-hidden="true" />
            </h1>
            <p className={styles.tagline}>{props.person.tagline}</p>
            <p className={styles.bio}>{props.person.bioLine}</p>
            <div className={styles.ctas}>
              <button className={styles.primary} type="button" onClick={props.onViewWork}>
                View Work
              </button>
              <button className={styles.secondary} type="button" onClick={props.onContact}>
                Contact
              </button>
            </div>
          </div>

          <aside className={styles.right} aria-label="Quick stats">
            <div className={styles.panel}>
              <div className={styles.panelTop}>
                <span className={styles.panelLabel}>Now</span>
                <span className={styles.panelValue}>{props.person.location}</span>
              </div>
              <div className={styles.stats}>
                {props.person.stats.map((s) => (
                  <div key={s.label} className={styles.stat}>
                    <div className={styles.statValue}>{s.value}</div>
                    <div className={styles.statLabel}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div className={styles.note}>
                <span className={styles.noteMark} aria-hidden="true" />
                <span>
                  Press <strong>Ctrl/Cmd K</strong> for a command palette.
                </span>
              </div>
            </div>
          </aside>
        </div>
      </Reveal>
    </section>
  );
}
