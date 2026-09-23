import emailjs from "@emailjs/browser";
import { useState, type FormEvent } from "react";
import { about, person, skills } from "../content";

const EMAIL_SERVICE = import.meta.env.VITE_EMAILJS_SERVICE_ID?.trim() ?? "";
const EMAIL_TEMPLATE = import.meta.env.VITE_EMAILJS_TEMPLATE_ID?.trim() ?? "";
const EMAIL_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY?.trim() ?? "";

function About() {
  return (
    <section id="about" className="block about">
      <p className="mono block__eyebrow">— Beyond the corridor</p>
      <h2 className="block__title">
        Hi, I'm {person.first.charAt(0) + person.first.slice(1).toLowerCase()}.
      </h2>
      <p className="about__lead">{about.lead}</p>
      <p className="about__body">{about.body}</p>
      <dl className="facts">
        {about.facts.map((f) => (
          <div key={f.k}>
            <dd>{f.v}</dd>
            <dt className="mono">{f.k}</dt>
          </div>
        ))}
      </dl>
      <ul className="highlights">
        {about.highlights.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>
    </section>
  );
}

/** Skills as a tilted planetary system: each orbit is a discipline, each body a tool. */
function Skills() {
  return (
    <section id="skills" className="block skills">
      <p className="mono block__eyebrow">— Things in my orbit</p>
      <h2 className="block__title">Stack</h2>
      <div className="system" aria-hidden>
        <div className="system__plane">
          <div className="system__sun" />
          {skills.map((s, i) => {
            const radius = 26 + i * 16;
            return (
              <div
                key={s.orbit}
                className="orbit"
                style={{ ["--r" as string]: `${radius}%`, ["--dur" as string]: `${50 + i * 22}s`, ["--dir" as string]: i % 2 ? "reverse" : "normal" }}
              >
                {s.items.map((item, j) => (
                  <div key={item} className="body" style={{ ["--a" as string]: `${(360 / s.items.length) * j + i * 17}deg` }}>
                    <span className="mono">{item}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <div className="skills__list">
        {skills.map((s) => (
          <div key={s.orbit}>
            <h3 className="mono">{s.orbit}</h3>
            <p>{s.items.join(" · ")}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Contact() {
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
      window.location.href = `mailto:${person.email}?subject=${encodeURIComponent(`Signal from ${name}`)}&body=${body}`;
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
    <section id="contact" className="block contact">
      <p className="mono block__eyebrow">— Transmit</p>
      <h2 className="block__title contact__title">
        Send a signal
        <br />
        <span>before it redshifts.</span>
      </h2>
      <div className="contact__grid">
        <form className="form" onSubmit={submit}>
          <label>
            <span className="mono">Name</span>
            <input name="name" required minLength={2} autoComplete="name" />
          </label>
          <label>
            <span className="mono">Email</span>
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label>
            <span className="mono">Message</span>
            <textarea name="message" required minLength={10} rows={4} />
          </label>
          <button className="btn btn--solid" disabled={status === "sending"}>
            {status === "sending" ? "Transmitting…" : status === "sent" ? "Signal received ✓" : "Transmit →"}
          </button>
          {status === "error" && <p className="form__error">Transmission failed — email me directly instead.</p>}
        </form>
        <div className="contact__links">
          <a href={`mailto:${person.email}`}>
            <span className="mono">Email</span>
            {person.email}
          </a>
          <a href={person.github} target="_blank" rel="noreferrer">
            <span className="mono">GitHub</span>
            {person.githubHandle}
          </a>
          <a href="/resume.html" target="_blank" rel="noreferrer">
            <span className="mono">Resume</span>
            View / print ↗
          </a>
        </div>
      </div>
      <footer className="footer mono">
        <span>© {new Date().getFullYear()} {person.name}</span>
        <span>Modeled in Blender · ray-traced in GLSL · no black holes were harmed</span>
      </footer>
    </section>
  );
}

export function Outro() {
  return (
    <div id="outro" className="outro">
      <About />
      <Skills />
      <Contact />
    </div>
  );
}
