import { useRef, type ReactNode } from "react";
import { useReveal } from "../lib/useReveal";

interface Props {
  id: string;
  eyebrow: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}

export function Section({ id, eyebrow, title, action, children }: Props) {
  const ref = useRef<HTMLElement>(null);
  useReveal(ref);

  return (
    <section ref={ref} id={id} aria-labelledby={`${id}-title`} className="portfolio-section mx-auto w-full px-4 py-14 sm:px-6">
      <div data-reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-body">{eyebrow}</p>
          <h2 id={`${id}-title`} className="mt-2 text-xl font-medium tracking-tight">
            {title}
          </h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
