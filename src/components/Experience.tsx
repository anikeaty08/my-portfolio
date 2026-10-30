import { education, experience, leadership } from "../data/content";
import { Section } from "./Section";

function Entry({
  title,
  org,
  meta,
  period,
  points,
}: {
  title: string;
  org: string;
  meta?: string;
  period: string;
  points?: string[];
}) {
  return (
    <article data-reveal className="relative border-l border-border pb-10 pl-8 last:pb-0">
      <span aria-hidden className="absolute -left-[5px] top-2 size-2.5 rounded-full bg-accent" />
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="text-xl font-semibold tracking-tight">{org}</h3>
        <p className="font-mono text-sm text-muted">{period}</p>
      </div>
      <p className="text-accent">{title}</p>
      {meta && <p className="text-sm text-muted">{meta}</p>}
      {points && (
        <ul className="mt-4 space-y-2 text-muted">
          {points.map((p) => (
            <li key={p} className="flex gap-3">
              <span aria-hidden className="mt-2.5 size-1 shrink-0 rounded-full bg-muted" />
              {p}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function Experience() {
  return (
    <Section id="experience" eyebrow="01 — Journey" title="Experience & education">
      <div className="grid gap-12 lg:grid-cols-2">
        <div>
          <Entry
            title={experience.role}
            org={experience.company}
            meta={experience.place}
            period={experience.period}
            points={experience.points}
          />
          <Entry
            title={leadership.role}
            org={leadership.org}
            period={leadership.period}
            points={leadership.points}
          />
        </div>
        <div>
          <Entry
            title={education.degree}
            org={education.school}
            meta={`${education.place} · CGPA ${education.cgpa}`}
            period={education.period}
          />
        </div>
      </div>
    </Section>
  );
}
