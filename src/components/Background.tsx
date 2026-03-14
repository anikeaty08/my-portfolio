import { useEffect } from "react";
import styles from "./Background.module.css";

export function Background(props: { reducedMotion: boolean }) {
  useEffect(() => {
    if (props.reducedMotion) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        document.documentElement.style.setProperty("--cursor-x", `${e.clientX}px`);
        document.documentElement.style.setProperty("--cursor-y", `${e.clientY}px`);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [props.reducedMotion]);

  return (
    <div className={styles.wrap} aria-hidden="true">
      <div className={styles.cursorGlow} />
      <div className={styles.shapeA} />
      <div className={styles.shapeB} />
      <div className={styles.scanlines} />
    </div>
  );
}

