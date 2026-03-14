import { useMemo, useState } from "react";
import type { SocialLinks } from "../content";
import { Reveal } from "./Reveal";
import styles from "./Contact.module.css";

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function Contact(props: { socials: SocialLinks }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [touched, setTouched] = useState<{ name: boolean; email: boolean; message: boolean }>({
    name: false,
    email: false,
    message: false,
  });
  const [success, setSuccess] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = "Please enter your name (at least 2 characters).";
    if (!isEmail(email)) e.email = "Please enter a valid email address.";
    if (message.trim().length < 10) e.message = "Message should be at least 10 characters.";
    return e;
  }, [email, message, name]);

  async function submit() {
    setTouched({ name: true, email: true, message: true });
    if (Object.keys(errors).length > 0) return;

    setSending(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      if (!res.ok) throw new Error("bad_response");
      setSuccess(true);
    } catch {
      setSubmitError("Backend is not responding. You can email me directly instead.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className={styles.section} id="contact" aria-label="Contact">
      <Reveal>
        <div className={styles.head}>
          <h2 className={styles.title}>Contact</h2>
          <p className={styles.sub}>
            Want to build something sharp? Send a note. I reply with clarity and next steps.
          </p>
        </div>
      </Reveal>

      <div className={styles.grid}>
        <Reveal>
          <div className={styles.card}>
            <h3 className={styles.h3}>Email & socials</h3>
            <div className={styles.socials}>
              {props.socials.email ? (
                <a className={styles.social} href={`mailto:${props.socials.email}`}>
                  Email
                </a>
              ) : null}
              <a className={styles.social} href={props.socials.github} target="_blank" rel="noreferrer">
                GitHub
              </a>
              {props.socials.linkedin ? (
                <a className={styles.social} href={props.socials.linkedin} target="_blank" rel="noreferrer">
                  LinkedIn
                </a>
              ) : null}
              {props.socials.x ? (
                <a className={styles.social} href={props.socials.x} target="_blank" rel="noreferrer">
                  X
                </a>
              ) : null}
              {props.socials.website ? (
                <a className={styles.social} href={props.socials.website} target="_blank" rel="noreferrer">
                  Website
                </a>
              ) : null}
            </div>
            <p className={styles.meta}>
              Prefer a quick jump? Press <strong>Ctrl/Cmd K</strong>.
              {!props.socials.email ? (
                <>
                  {" "}
                  (Email isn’t public on GitHub—add it in <code>src/content.ts</code> if you want a mailto link.)
                </>
              ) : null}
            </p>
          </div>
        </Reveal>

        <Reveal>
          <div className={styles.formCard}>
            <h3 className={styles.h3}>Send a message</h3>

            {success ? (
              <div className={styles.success} role="status" aria-live="polite">
                <div className={styles.successMark} aria-hidden="true" />
                <div>
                  <div className={styles.successTitle}>Message queued.</div>
                  <p className={styles.successBody}>
                    Saved. I will read it and reply to your email.
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.reset}
                  onClick={() => {
                    setSuccess(false);
                    setName("");
                    setEmail("");
                    setMessage("");
                    setTouched({ name: false, email: false, message: false });
                    setSubmitError(null);
                  }}
                >
                  Send another
                </button>
              </div>
            ) : (
              <form
                className={styles.form}
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit();
                }}
                noValidate
              >
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="contact-name">
                    Name
                  </label>
                  <input
                    id="contact-name"
                    className={styles.input}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                    aria-invalid={Boolean(touched.name && errors.name)}
                    aria-describedby={touched.name && errors.name ? "err-name" : undefined}
                    autoComplete="name"
                    required
                  />
                  {touched.name && errors.name ? (
                    <div className={styles.error} id="err-name" role="status">
                      {errors.name}
                    </div>
                  ) : null}
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="contact-email">
                    Email
                  </label>
                  <input
                    id="contact-email"
                    className={styles.input}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                    aria-invalid={Boolean(touched.email && errors.email)}
                    aria-describedby={touched.email && errors.email ? "err-email" : undefined}
                    autoComplete="email"
                    required
                  />
                  {touched.email && errors.email ? (
                    <div className={styles.error} id="err-email" role="status">
                      {errors.email}
                    </div>
                  ) : null}
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="contact-message">
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    className={styles.textarea}
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, message: true }))}
                    aria-invalid={Boolean(touched.message && errors.message)}
                    aria-describedby={touched.message && errors.message ? "err-message" : undefined}
                    required
                  />
                  {touched.message && errors.message ? (
                    <div className={styles.error} id="err-message" role="status">
                      {errors.message}
                    </div>
                  ) : null}
                </div>

                <button className={styles.submit} type="submit" disabled={sending}>
                  {sending ? "Sending..." : "Send"}
                </button>
                {submitError ? (
                  <div className={styles.error} role="status">
                    {submitError}{" "}
                    {props.socials.email ? (
                      <a href={`mailto:${props.socials.email}`} style={{ color: "inherit" }}>
                        Email
                      </a>
                    ) : null}
                  </div>
                ) : null}
                <p className={styles.formMeta}>
                  By sending, you confirm this is a real message (and not a pitch deck).
                </p>
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
