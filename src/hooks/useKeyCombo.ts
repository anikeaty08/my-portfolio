import { useEffect } from "react";

type Combo = {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
};

export function useKeyCombo(combo: Combo, onMatch: () => void, opts?: { enabled?: boolean }) {
  useEffect(() => {
    if (opts?.enabled === false) return;
    const handler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key !== combo.key.toLowerCase()) return;
      if (combo.metaKey !== undefined && e.metaKey !== combo.metaKey) return;
      if (combo.ctrlKey !== undefined && e.ctrlKey !== combo.ctrlKey) return;
      if (combo.shiftKey !== undefined && e.shiftKey !== combo.shiftKey) return;
      if (combo.altKey !== undefined && e.altKey !== combo.altKey) return;

      e.preventDefault();
      onMatch();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [combo.altKey, combo.ctrlKey, combo.key, combo.metaKey, combo.shiftKey, onMatch, opts?.enabled]);
}

