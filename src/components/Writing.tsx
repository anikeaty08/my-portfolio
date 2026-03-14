import { useEffect, useState } from "react";
import type { Post } from "../content";
import { Reveal } from "./Reveal";
import { NoteModal, type Note } from "./NoteModal";
import styles from "./Writing.module.css";

export function Writing(props: { posts: Post[] }) {
  const [livePosts, setLivePosts] = useState<Post[] | null>(null);
  const [activeNote, setActiveNote] = useState<Note | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/posts?limit=12")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || cancelled) return;
        if (Array.isArray(data.posts)) setLivePosts(data.posts);
      })
      .catch(() => {
        // ignore; fallback to static posts
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const posts = livePosts ?? props.posts;

  async function openNote(p: Post) {
    if (p.body) {
      setActiveNote({ title: p.title, date: p.date, body: p.body });
      return;
    }

    if (p.id) {
      try {
        const res = await fetch(`/api/posts/${encodeURIComponent(p.id)}`);
        if (!res.ok) throw new Error("bad_response");
        const data = (await res.json()) as { title: string; body: string; date: string };
        setActiveNote({ title: data.title, date: data.date, body: data.body });
        return;
      } catch {
        // fall through to excerpt only
      }
    }

    setActiveNote({ title: p.title, date: p.date, body: p.excerpt });
  }

  return (
    <section className={styles.section} id="writing" aria-label="Writing and notes">
      <Reveal>
        <div className={styles.head}>
          <h2 className={styles.title}>Writing / Notes</h2>
          <p className={styles.sub}>Short notes on building: UI systems, Web3 UX, and agentic pipelines.</p>
        </div>
      </Reveal>

      <div className={styles.grid}>
        {posts.map((p) => (
          <Reveal key={p.title}>
            <article className={styles.card}>
              <button
                type="button"
                className={styles.openOverlay}
                aria-label={`Open note: ${p.title}`}
                onClick={() => openNote(p)}
              />
              <div className={styles.top}>
                <h3 className={styles.cardTitle}>{p.title}</h3>
                <time className={styles.date}>{p.date}</time>
              </div>
              <p className={styles.excerpt}>{p.excerpt}</p>
              <div className={styles.readMore} aria-hidden="true">
                Read note <span className={styles.arrow}>→</span>
              </div>
            </article>
          </Reveal>
        ))}
      </div>

      <NoteModal note={activeNote} onClose={() => setActiveNote(null)} />
    </section>
  );
}
