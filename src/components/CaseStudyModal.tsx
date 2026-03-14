import { useEffect, useMemo, useRef } from "react";
import type { Project } from "../content";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useScrollLock } from "../hooks/useScrollLock";
import styles from "./CaseStudyModal.module.css";

export function CaseStudyModal(props: { project: Project | null; onClose: () => void }) {
  const open = Boolean(props.project);
  const containerRef = useRef<HTMLDivElement | null>(null);
  useScrollLock(open);
  useFocusTrap(open, containerRef.current, props.onClose);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, props.onClose]);

  const titleId = useMemo(() => (props.project ? `case-${props.project.slug}-title` : "case-title"), [props.project]);

  if (!open || !props.project) return null;
  const p = props.project;
  const cs = p.caseStudy;

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={containerRef}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <p className={styles.kicker}>Case Study</p>
            <h2 className={styles.title} id={titleId}>
              {p.title}
            </h2>
            <p className={styles.metric}>{p.impactMetric}</p>
          </div>
          <button className={styles.close} type="button" onClick={props.onClose} aria-label="Close case study">
            Close
          </button>
        </div>

        <div className={styles.body}>
          {cs ? (
            <>
              <section className={styles.block} aria-label="Problem">
                <h3 className={styles.h3}>Problem</h3>
                <p className={styles.p}>{cs.problem}</p>
              </section>

              <section className={styles.block} aria-label="Constraints">
                <h3 className={styles.h3}>Constraints</h3>
                <ul className={styles.list}>
                  {cs.constraints.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </section>

              <section className={styles.block} aria-label="Approach">
                <h3 className={styles.h3}>Approach</h3>
                <ul className={styles.list}>
                  {cs.approach.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </section>

              <section className={styles.block} aria-label="Results">
                <h3 className={styles.h3}>Results</h3>
                <ul className={styles.listStrong}>
                  {cs.results.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </section>
            </>
          ) : (
            <section className={styles.block} aria-label="Case study unavailable">
              <h3 className={styles.h3}>Case Study</h3>
              <p className={styles.p}>No case study added yet. Add one from /admin when ready.</p>
            </section>
          )}

          <section className={styles.block} aria-label="Screenshots">
            <h3 className={styles.h3}>Screenshots</h3>
            <div className={styles.shots} aria-label="Screenshot placeholders">
              <figure className={styles.shot}>
                <div className={styles.shotInner} />
                <figcaption className={styles.caption}>Dashboard view (placeholder)</figcaption>
              </figure>
              <figure className={styles.shot}>
                <div className={styles.shotInner} />
                <figcaption className={styles.caption}>Detail view (placeholder)</figcaption>
              </figure>
            </div>
          </section>

          <div className={styles.footer}>
            {p.links.live ? (
              <a className={styles.footerLink} href={p.links.live} target="_blank" rel="noreferrer">
                Open Live
              </a>
            ) : null}
            {p.links.github ? (
              <a className={styles.footerLink} href={p.links.github} target="_blank" rel="noreferrer">
                View GitHub
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
