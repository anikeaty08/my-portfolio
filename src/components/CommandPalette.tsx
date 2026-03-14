import { useEffect, useMemo, useRef, useState } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useScrollLock } from "../hooks/useScrollLock";
import styles from "./CommandPalette.module.css";

export type PaletteAction = {
  id: string;
  label: string;
  group: string;
  keywords?: readonly string[];
  run: () => void;
};

function scoreAction(query: string, a: PaletteAction) {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const hay = [a.label, a.group, ...(a.keywords ?? [])].join(" ").toLowerCase();
  if (hay.includes(q)) return 3;
  const words = q.split(/\s+/).filter(Boolean);
  const all = words.every((w) => hay.includes(w));
  return all ? 2 : 0;
}

export function CommandPalette(props: { open: boolean; actions: PaletteAction[]; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useScrollLock(props.open);
  useFocusTrap(props.open, containerRef.current, props.onClose);

  useEffect(() => {
    if (!props.open) return;
    setQuery("");
    setActiveIndex(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [props.open]);

  const filtered = useMemo(() => {
    const scored = props.actions
      .map((a) => ({ a, s: scoreAction(query, a) }))
      .filter((x) => x.s > 0)
      .sort((l, r) => r.s - l.s || l.a.label.localeCompare(r.a.label));
    return scored.map((x) => x.a);
  }, [props.actions, query]);

  useEffect(() => {
    if (activeIndex > filtered.length - 1) setActiveIndex(0);
  }, [activeIndex, filtered.length]);

  const titleId = "command-palette-title";
  const descId = "command-palette-desc";

  if (!props.open) return null;

  const active = filtered[activeIndex];
  const groups = filtered.reduce<Record<string, PaletteAction[]>>((acc, a) => {
    (acc[a.group] ??= []).push(a);
    return acc;
  }, {});

  function runAction(a: PaletteAction) {
    props.onClose();
    window.setTimeout(() => a.run(), 0);
  }

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descId} ref={containerRef}>
        <div className={styles.top}>
          <div>
            <h2 className={styles.title} id={titleId}>
              Command Palette
            </h2>
            <p className={styles.desc} id={descId}>
              Type to filter. Use Up/Down then Enter. Esc closes.
            </p>
          </div>
          <button className={styles.close} type="button" onClick={props.onClose} aria-label="Close command palette">
            Close
          </button>
        </div>

        <div className={styles.searchRow}>
          <span className={styles.prompt} aria-hidden="true">
            &gt;
          </span>
          <input
            ref={inputRef}
            className={styles.input}
            value={query}
            placeholder="Jump to... / Open... / Toggle..."
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
              }
              if (e.key === "Enter") {
                e.preventDefault();
                if (active) runAction(active);
              }
              if (e.key === "Escape") {
                e.preventDefault();
                props.onClose();
              }
            }}
          />
        </div>

        <div className={styles.listWrap} role="list" aria-label="Commands">
          {filtered.length === 0 ? (
            <div className={styles.empty} role="status" aria-live="polite">
              No matches. Try \"work\", \"email\", or \"motion\".
            </div>
          ) : (
            Object.entries(groups).map(([group, actions]) => (
              <div key={group} className={styles.group}>
                <div className={styles.groupTitle}>{group}</div>
                <div className={styles.groupList}>
                  {actions.map((a) => {
                    const idx = filtered.findIndex((x) => x.id === a.id);
                    const selected = idx === activeIndex;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        className={[styles.item, selected ? styles.selected : ""].join(" ")}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => runAction(a)}
                      >
                        <span className={styles.itemLabel}>{a.label}</span>
                        <span className={styles.itemMeta} aria-hidden="true">
                          {a.group}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className={styles.hints} aria-hidden="true">
          <span>Ctrl/Cmd K</span>
          <span>Enter</span>
          <span>Esc</span>
        </div>
      </div>
    </div>
  );
}
