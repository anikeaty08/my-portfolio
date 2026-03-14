import { useEffect, useMemo, useRef } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useScrollLock } from "../hooks/useScrollLock";
import styles from "./NoteModal.module.css";

export type Note = {
  title: string;
  date: string;
  body: string;
};

export function NoteModal(props: { note: Note | null; onClose: () => void }) {
  const open = Boolean(props.note);
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

  const titleId = useMemo(() => (props.note ? `note-${props.note.title.replace(/\s+/g, "-")}` : "note-title"), [props.note]);

  if (!open || !props.note) return null;

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
            <p className={styles.kicker}>Note</p>
            <h2 className={styles.title} id={titleId}>
              {props.note.title}
            </h2>
            <p className={styles.meta}>{props.note.date}</p>
          </div>
          <button className={styles.close} type="button" onClick={props.onClose} aria-label="Close note">
            Close
          </button>
        </div>

        <div className={styles.body}>
          {props.note.body.split(/\n\s*\n/).map((para, idx) => (
            <p className={styles.p} key={idx}>
              {para}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

