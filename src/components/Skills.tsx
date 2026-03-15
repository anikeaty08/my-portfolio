import { useEffect, useState } from "react";
import { Reveal } from "./Reveal";
import styles from "./Skills.module.css";

export function Skills(props: { groups: Record<string, readonly string[]> }) {
  const [liveGroups, setLiveGroups] = useState<Record<string, string[]> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/site/skills")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || cancelled) return;
        if (data.skills && typeof data.skills === "object") {
          const obj = data.skills as Record<string, string[]>;
          setLiveGroups(obj);
        }
      })
      .catch(() => {
        // ignore; fallback to static skills
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = (liveGroups ?? props.groups) as Record<string, readonly string[]>;

  return (
    <section className={styles.section} id="skills" aria-label="Skills">
      <Reveal>
        <div className={styles.head}>
          <h2 className={styles.title}>Skills</h2>
          <p className={styles.sub}>Grouped by how I ship: interface, systems, reliability, and craft.</p>
        </div>
      </Reveal>

      <div className={styles.groups}>
        {Object.entries(groups).map(([group, items]) => (
          <Reveal key={group}>
            <section className={styles.group} aria-label={group}>
              <h3 className={styles.groupTitle}>{group}</h3>
              <div className={styles.chips}>
                {items.map((s) => (
                  <span key={s} className={styles.chip}>
                    {s}
                  </span>
                ))}
              </div>
            </section>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
