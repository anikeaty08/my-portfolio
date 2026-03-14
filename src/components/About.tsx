import { useState } from "react";
import { Reveal } from "./Reveal";
import styles from "./About.module.css";

export function About(props: {
  about: {
    paragraphs: string[];
    values: { title: string; body: string }[];
    toolset: string[];
  };
}) {
  const [portraitOk, setPortraitOk] = useState(true);

  return (
    <section className={styles.section} id="about" aria-label="About">
      <Reveal>
        <div className={styles.head}>
          <h2 className={styles.title}>About</h2>
          <p className={styles.sub}>A blend of engineering discipline and design taste, built for shipping.</p>
        </div>
      </Reveal>

      <div className={styles.grid}>
        <Reveal>
          <div className={styles.bioCard}>
            {props.about.paragraphs.map((p) => (
              <p key={p} className={styles.p}>
                {p}
              </p>
            ))}
            <div className={styles.toolset} aria-label="Toolset">
              {props.about.toolset.map((t) => (
                <span key={t} className={styles.tool}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div className={styles.photoCard}>
            <figure className={styles.figure}>
              {portraitOk ? (
                <img
                  className={styles.portrait}
                  src="/portrait.jpg"
                  alt="Portrait of Anikeat Yadav"
                  loading="lazy"
                  onError={() => setPortraitOk(false)}
                />
              ) : (
                <div className={styles.avatar} role="img" aria-label="Portrait">
                  <span className={styles.initials} aria-hidden="true">
                    AY
                  </span>
                </div>
              )}
              <figcaption className={styles.caption}>Anikeat Yadav</figcaption>
            </figure>
          </div>
        </Reveal>
      </div>

      <Reveal>
        <div className={styles.values}>
          <h3 className={styles.valuesTitle}>Values</h3>
          <div className={styles.valuesGrid}>
            {props.about.values.map((v) => (
              <div key={v.title} className={styles.value}>
                <div className={styles.valueTop}>
                  <span className={styles.valueMark} aria-hidden="true" />
                  <h4 className={styles.valueTitle}>{v.title}</h4>
                </div>
                <p className={styles.valueBody}>{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
