import emailjs from "@emailjs/browser";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { about, experience, person, projects, skills, type Project } from "../content";
import { setState, useStore, type ZoneId } from "../store";

const EMAIL_SERVICE = import.meta.env.VITE_EMAILJS_SERVICE_ID?.trim() ?? "";
const EMAIL_TEMPLATE = import.meta.env.VITE_EMAILJS_TEMPLATE_ID?.trim() ?? "";
const EMAIL_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY?.trim() ?? "";

export function zoneInfo(id: ZoneId): { title: string; kicker: string } {
  if (id.startsWith("project:")) {
    const p = projects.find((q) => q.slug === id.slice(8));
    return { title: p?.title ?? "Project", kicker: p?.tagline ?? "Project" };
  }
  return (
    {
      about: { title: "About me", kicker: "The cabin" },
      skills: { title: "Skills", kicker: "The billboard" },
      contact: { title: "Contact", kicker: "The mailbox" },
      lighthouse: { title: "Lights out?", kicker: "The lighthouse" },
      bowling: { title: "Bowling", kicker: "Lane one" },
      mcp: { title: "Connect your AI", kicker: "MCP server" },
    } as Record<string, { title: string; kicker: string }>
  )[id] ?? { title: id, kicker: "" };
}

export function Chips({ items }: { items: string[] }) {
  return (
    <ul className="chips">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

/** Link buttons for a project, in a consistent order. */
export function ProjectLinks({ p, small }: { p: Project; small?: boolean }) {
  const size = small ? " btn--small" : "";
  const links = [
    p.links.live && { href: p.links.live, label: "Live" },
    p.links.github && { href: p.links.github, label: "GitHub" },
    p.links.npm && { href: p.links.npm, label: "npm" },
    p.links.pypi && { href: p.links.pypi, label: "PyPI" },
  ].filter(Boolean) as { href: string; label: string }[];
  if (!links.length) return null;
  return (
    <div className="actions">
      {links.map((l, i) => (
        <a key={l.label} className={`btn${size}${i === 0 ? " btn--primary" : ""}`} href={l.href} target="_blank" rel="noreferrer">
          {l.label} ↗
        </a>
      ))}
    </div>
  );
}

export function ExperienceList() {
  return (
    <ul className="timeline">
      {experience.map((e) => (
        <li key={e.org + e.role}>
          <div className="timeline__head">
            <strong>{e.role}</strong>
            <span>{e.dates}</span>
          </div>
          <p className="timeline__org">{e.org}</p>
          <ul className="ticks">
            {e.points.map((pt) => (
              <li key={pt}>{pt}</li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

export function ProjectBody({ p }: { p: Project }) {
  return (
    <>
      <p className="lead">{p.oneLiner}</p>
      <Chips items={p.tech} />
      <h3>The problem</h3>
      <p>{p.caseStudy.problem}</p>
      <h3>What I built</h3>
      <ul className="ticks">
        {p.caseStudy.approach.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
      <h3>Outcome</h3>
      <ul className="ticks">
        {p.caseStudy.results.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
      <ProjectLinks p={p} />
    </>
  );
}

export function AboutBody() {
  return (
    <>
      <p className="lead">{about.lead}</p>
      <p>{about.body}</p>
      <dl className="facts">
        {about.facts.map((f) => (
          <div key={f.k}>
            <dd>{f.v}</dd>
            <dt>{f.k}</dt>
          </div>
        ))}
      </dl>
      <h3>Highlights</h3>
      <ul className="ticks">
        {about.highlights.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>
      <h3>Experience</h3>
      <ExperienceList />
      <p className="muted">
        {person.education} · {person.location} · {person.status}
      </p>
    </>
  );
}

export function SkillsBody() {
  return (
    <>
      <p className="lead">The stack I reach for, grouped the same way as the scoreboard outside.</p>
      {skills.map((s) => (
        <div key={s.orbit} className="skill-group">
          <h3>{s.orbit}</h3>
          <Chips items={s.items} />
        </div>
      ))}
    </>
  );
}

export function ContactBody() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const configured = Boolean(EMAIL_SERVICE && EMAIL_TEMPLATE && EMAIL_KEY);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();
    if (!configured) {
      const body = encodeURIComponent(`${message}\n\n— ${name} (${email})`);
      window.location.href = `mailto:${person.email}?subject=${encodeURIComponent(`Hello from ${name}`)}&body=${body}`;
      return;
    }
    setStatus("sending");
    try {
      await emailjs.send(EMAIL_SERVICE, EMAIL_TEMPLATE, { name, email, message }, { publicKey: EMAIL_KEY });
      setStatus("sent");
      form.reset();
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      <p className="lead">Hiring, collaborating, or curious about a project? I usually reply within a day.</p>
      <form className="form" onSubmit={submit}>
        <label>
          Name
          <input name="name" required minLength={2} autoComplete="name" />
        </label>
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Message
          <textarea name="message" required minLength={10} rows={4} />
        </label>
        <button className="btn btn--primary" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : status === "sent" ? "Sent — thank you!" : "Send message"}
        </button>
        {status === "error" && <p className="error">That didn't go through — email me directly instead.</p>}
      </form>
      <div className="links">
        <a href={`mailto:${person.email}`}>{person.email}</a>
        <a href={person.github} target="_blank" rel="noreferrer">
          GitHub {person.githubHandle} ↗
        </a>
        <a href="/resume.html" target="_blank" rel="noreferrer">
          Resume ↗
        </a>
      </div>
    </>
  );
}

function LighthouseBody() {
  const night = useStore((s) => s.night);
  return (
    <>
      <p className="lead">The keeper hands you the switch. The island looks different after dark — headlights included.</p>
      <div className="actions">
        <button className="btn btn--primary" onClick={() => setState({ night: !night })}>
          {night ? "Bring back the sun" : "Turn off the sun"}
        </button>
      </div>
      <p className="muted">Shortcut: press N anywhere.</p>
    </>
  );
}

function BowlingBody() {
  return (
    <>
      <p className="lead">Nudge the ball down the lane with your bumper — gently, or it jumps the gutter. All ten pins earns a trophy.</p>
      <p className="muted">The pins reset themselves a few seconds after every roll.</p>
    </>
  );
}

const MCP_URL = "https://www.anikeaty08.tech/api/mcp";

function McpBody() {
  const [copied, setCopied] = useState(false);
  const config = JSON.stringify({ mcpServers: { anikeat: { url: MCP_URL } } }, null, 2);
  const copy = () => {
    void navigator.clipboard?.writeText(MCP_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };
  return (
    <>
      <p className="lead">This portfolio is also an MCP server. Plug it into your AI assistant and ask it about my work.</p>
      <div className="mcp-url">
        <code>{MCP_URL}</code>
        <button className="btn btn--small btn--primary" onClick={copy}>
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <h3>Tools it exposes</h3>
      <ul className="ticks">
        <li>get_profile, get_skills, get_contact</li>
        <li>list_projects (filter by tech, e.g. “MCP”)</li>
        <li>get_project — the full case study</li>
      </ul>
      <h3>Claude / ChatGPT</h3>
      <p>Add a custom connector (remote MCP server) and paste the URL above.</p>
      <h3>Cursor, VS Code & other clients</h3>
      <pre className="code">{config}</pre>
      <p className="muted">Then try: “What has Anikeat built with MCP?”</p>
    </>
  );
}

function body(id: ZoneId): ReactNode {
  if (id.startsWith("project:")) {
    const p = projects.find((q) => q.slug === id.slice(8));
    return p ? <ProjectBody p={p} /> : null;
  }
  if (id === "about") return <AboutBody />;
  if (id === "skills") return <SkillsBody />;
  if (id === "contact") return <ContactBody />;
  if (id === "lighthouse") return <LighthouseBody />;
  if (id === "bowling") return <BowlingBody />;
  if (id === "mcp") return <McpBody />;
  return null;
}

/** Slide-in panel for whichever zone is open. */
export function Panel() {
  const panel = useStore((s) => s.panel);
  const [shown, setShown] = useState<ZoneId | null>(panel);
  useEffect(() => {
    if (panel) setShown(panel);
  }, [panel]);

  const info = shown ? zoneInfo(shown) : null;
  const accent = shown?.startsWith("project:") ? projects.find((q) => q.slug === shown.slice(8))?.color : undefined;

  return (
    <aside className={`panel ${panel ? "is-open" : ""}`} aria-hidden={!panel} style={accent ? { ["--accent" as string]: accent } : undefined}>
      {shown && info && (
        <div className="panel__inner" key={shown}>
          <div className="panel__head">
            <p className="kicker">{info.kicker}</p>
            <button className="icon-btn" onClick={() => setState({ panel: null })} aria-label="Close">
              ✕
            </button>
          </div>
          <h2>{info.title}</h2>
          {body(shown)}
          <p className="panel__hint">
            <kbd>Esc</kbd> to close and keep driving
          </p>
        </div>
      )}
    </aside>
  );
}
