import { skills } from "../data/content";
import { Section } from "./Section";

export function Skills() {
  return (
    <Section id="skills" eyebrow="03 — Toolkit" title="Technical skills">
      <dl className="divide-y divide-border rounded-2xl border border-border bg-card">
        {skills.map((s) => (
          <div key={s.group} data-reveal className="grid gap-3 p-5 sm:grid-cols-[12rem_1fr] sm:items-center sm:p-6">
            <dt className="font-mono text-sm text-accent">{s.group}</dt>
            <dd>
              <ul className="flex flex-wrap gap-2">
                {s.items.map((i) => (
                  <li key={i} className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm">
                    {i}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
