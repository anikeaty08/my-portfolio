import { sectionOrder } from "../content";
import styles from "./Header.module.css";

function scrollToId(id: string, reducedMotion: boolean) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
}

export function Header(props: {
  name: string;
  onOpenPalette: () => void;
  reducedMotion: boolean;
}) {
  const nav = sectionOrder.filter((s) => ["work", "about", "experience", "writing", "contact"].includes(s.id));

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <a
          className={styles.brand}
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            scrollToId("top", props.reducedMotion);
          }}
        >
          <span className={styles.mark} aria-hidden="true" />
          <span className={styles.name}>{props.name}</span>
        </a>

        <nav className={styles.nav} aria-label="Primary">
          {nav.map((item) => (
            <a
              key={item.id}
              className={styles.navLink}
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault();
                scrollToId(item.id, props.reducedMotion);
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className={styles.actions}>
          <button className={styles.paletteButton} type="button" onClick={props.onOpenPalette}>
            Command <kbd className={styles.kbd}>Ctrl/Cmd K</kbd>
          </button>
        </div>
      </div>
    </header>
  );
}
