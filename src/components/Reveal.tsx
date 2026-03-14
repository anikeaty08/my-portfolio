import type { ReactNode } from "react";
import { useInView } from "../hooks/useInView";
import styles from "./Reveal.module.css";

export function Reveal(props: { children: ReactNode; className?: string }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className={[styles.reveal, inView ? styles.in : "", props.className ?? ""].join(" ")}>
      {props.children}
    </div>
  );
}

