import { useEffect, useRef, useState } from "react";

export function useInView<T extends HTMLElement>(opts?: { threshold?: number; rootMargin?: string }) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // If IntersectionObserver isn't available (older browsers / embedded webviews),
    // don't hide content behind a reveal state.
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: opts?.threshold ?? 0.18, rootMargin: opts?.rootMargin ?? "0px 0px -8% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [opts?.rootMargin, opts?.threshold]);

  return { ref, inView } as const;
}
