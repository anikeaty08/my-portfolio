import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { projects, type Project } from "../data/content";
import { Section } from "./Section";

function Card({ p }: { p: Project }) {
  return (
    <motion.article
      data-reveal
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={`group flex flex-col rounded-2xl border bg-card p-6 transition-colors hover:border-accent/60 ${
        p.featured ? "border-border lg:p-8" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold tracking-tight">{p.name}</h3>
          <p className="text-sm text-accent">{p.kind}</p>
        </div>
        {p.period && <p className="shrink-0 font-mono text-xs text-muted">{p.period}</p>}
        {p.status && (
          <p className="shrink-0 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 font-mono text-xs text-accent">{p.status}</p>
        )}
      </div>

      <p className="mt-4 text-muted">{p.summary}</p>

      {p.points && (
        <ul className="mt-4 space-y-2 text-sm text-muted">
          {p.points.map((pt) => (
            <li key={pt} className="flex gap-3">
              <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-accent" />
              {pt}
            </li>
          ))}
        </ul>
      )}

      <ul className="mt-5 flex flex-wrap gap-2" aria-label="Technologies">
        {p.tags.map((t) => (
          <li key={t} className="rounded-md border border-border bg-surface-2 px-2.5 py-1 font-mono text-xs text-muted">
            {t}
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-wrap gap-2 pt-6">
        {p.links.length === 0 && <p className="text-sm text-muted">No public link yet.</p>}
        {p.links.map((l) => (
          <a
            key={l.href}
            href={l.href}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`${p.name}: ${l.label} (opens in a new tab)`}
            className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-border px-3.5 text-sm font-medium transition hover:border-accent hover:text-accent"
          >
            {l.label} <ArrowUpRight size={14} aria-hidden />
          </a>
        ))}
      </div>
    </motion.article>
  );
}

export function Projects() {
  return (
    <Section id="projects" eyebrow="02 — Work" title="Selected projects">
      <div className="grid gap-5 md:grid-cols-2">
        {projects.map((p) => (
          <Card key={p.name} p={p} />
        ))}
      </div>
    </Section>
  );
}
