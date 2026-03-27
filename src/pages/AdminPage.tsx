import { useEffect, useMemo, useState } from "react";
import type { Project } from "../content";
import styles from "./AdminPage.module.css";

type AdminPost = {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  publishedAt: string; // YYYY-MM-DD
};

type SitePayload = {
  skills: Record<string, string[]>;
  projects: Project[];
};

function getToken() {
  return localStorage.getItem("adminToken") ?? "";
}

function setToken(token: string) {
  if (!token) localStorage.removeItem("adminToken");
  else localStorage.setItem("adminToken", token);
}

async function api<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, opts);
  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => "");
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    (err as any).status = res.status;
    (err as any).body = body;
    throw err;
  }
  return body as T;
}

export function AdminPage() {
  const [token, setTokenState] = useState(() => getToken());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [tab, setTab] = useState<"posts" | "skills" | "projects" | "json">("posts");

  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = useMemo(() => posts.find((p) => p.id === activeId) ?? null, [activeId, posts]);

  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [publishedAt, setPublishedAt] = useState(() => new Date().toISOString().slice(0, 10));

  const [siteSkills, setSiteSkills] = useState<Record<string, string[]>>({});
  const [siteProjects, setSiteProjects] = useState<Project[]>([]);

  const [activeSkillGroup, setActiveSkillGroup] = useState<string | null>(null);
  const [skillGroupName, setSkillGroupName] = useState("");
  const [skillItemsText, setSkillItemsText] = useState("");

  const [activeProjectSlug, setActiveProjectSlug] = useState<string | null>(null);
  const activeProject = useMemo(
    () => siteProjects.find((p) => p.slug === activeProjectSlug) ?? null,
    [activeProjectSlug, siteProjects],
  );

  const [projSlug, setProjSlug] = useState("");
  const [projTitle, setProjTitle] = useState("");
  const [projImpactMetric, setProjImpactMetric] = useState("");
  const [projOneLiner, setProjOneLiner] = useState("");
  const [projRole, setProjRole] = useState("");
  const [projTechText, setProjTechText] = useState("");
  const [projLive, setProjLive] = useState("");
  const [projGithub, setProjGithub] = useState("");
  const [projCoverImage, setProjCoverImage] = useState("");
  const [projScreenshots, setProjScreenshots] = useState<{ src: string; caption?: string }[]>([]);
  const [projHasCaseStudy, setProjHasCaseStudy] = useState(false);
  const [projProblem, setProjProblem] = useState("");
  const [projConstraintsText, setProjConstraintsText] = useState("");
  const [projApproachText, setProjApproachText] = useState("");
  const [projResultsText, setProjResultsText] = useState("");

  const [skillsJson, setSkillsJson] = useState("{}");
  const [projectsJson, setProjectsJson] = useState("[]");

  function listFromText(text: string) {
    return text
      .split(/\r?\n|,/g)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function textFromList(list: readonly string[]) {
    return list.join("\n");
  }

  function resetPostForm() {
    setActiveId(null);
    setTitle("");
    setExcerpt("");
    setBody("");
    setPublishedAt(new Date().toISOString().slice(0, 10));
  }

  function resetSkillForm() {
    setActiveSkillGroup(null);
    setSkillGroupName("");
    setSkillItemsText("");
  }

  function resetProjectForm() {
    setActiveProjectSlug(null);
    setProjSlug("");
    setProjTitle("");
    setProjImpactMetric("");
    setProjOneLiner("");
    setProjRole("");
    setProjTechText("");
    setProjLive("");
    setProjGithub("");
    setProjCoverImage("");
    setProjScreenshots([]);
    setProjHasCaseStudy(false);
    setProjProblem("");
    setProjConstraintsText("");
    setProjApproachText("");
    setProjResultsText("");
  }

  async function reloadAll() {
    if (!token) return;
    const [postsData, site] = await Promise.all([
      api<{ posts: AdminPost[] }>("/api/admin/posts", { headers: { Authorization: `Bearer ${token}` } }),
      api<SitePayload>("/api/admin/site", { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    setPosts(postsData.posts);
    setSiteSkills(site.skills ?? {});
    setSiteProjects(Array.isArray(site.projects) ? site.projects : []);
    setSkillsJson(JSON.stringify(site.skills ?? {}, null, 2));
    setProjectsJson(JSON.stringify(site.projects ?? [], null, 2));
  }

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    reloadAll()
      .catch((e) => {
        const status = (e as any)?.status as number | undefined;
        const body = (e as any)?.body as any;
        const code = typeof body?.error === "string" ? body.error : "";

        if (status === 401 || status === 403) {
          setToken("");
          setTokenState("");
          setError("Session expired or invalid token. Please log in again.");
          return;
        }

        if (code === "missing_mongodb_uri") {
          setError("Backend is running, but MONGODB_URI is missing. Set it in .env and restart the server.");
          return;
        }

        if (code === "db_unavailable") {
          setError("Backend can't reach MongoDB. Check MONGODB_URI and that your IP is allowed in Atlas.");
          return;
        }

        setError("Failed to load admin data. Check backend logs, MongoDB URI, and token.");
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!active) return;
    setTitle(active.title);
    setExcerpt(active.excerpt);
    setBody(active.body);
    setPublishedAt(active.publishedAt);
  }, [active]);

  useEffect(() => {
    if (activeSkillGroup == null) {
      setSkillGroupName("");
      setSkillItemsText("");
      return;
    }
    const items = siteSkills[activeSkillGroup] ?? [];
    setSkillGroupName(activeSkillGroup);
    setSkillItemsText(textFromList(items));
  }, [activeSkillGroup, siteSkills]);

  useEffect(() => {
    if (!activeProject) {
      resetProjectForm();
      return;
    }
    setProjSlug(activeProject.slug);
    setProjTitle(activeProject.title);
    setProjImpactMetric(activeProject.impactMetric);
    setProjOneLiner(activeProject.oneLiner);
    setProjRole(activeProject.role);
    setProjTechText(textFromList(activeProject.tech));
    setProjLive(activeProject.links?.live ?? "");
    setProjGithub(activeProject.links?.github ?? "");
    setProjCoverImage(activeProject.coverImage ?? "");
    setProjScreenshots(Array.isArray(activeProject.screenshots) ? activeProject.screenshots : []);
    const cs = activeProject.caseStudy;
    setProjHasCaseStudy(Boolean(cs));
    setProjProblem(cs?.problem ?? "");
    setProjConstraintsText(textFromList(cs?.constraints ?? []));
    setProjApproachText(textFromList(cs?.approach ?? []));
    setProjResultsText(textFromList(cs?.results ?? []));
  }, [activeProject]);

  async function fileToDataUrl(file: File) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("read_failed"));
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.readAsDataURL(file);
    });
  }

  async function uploadImage(file: File) {
    if (!token) throw new Error("missing_token");
    const dataUrl = await fileToDataUrl(file);
    const res = await api<{ id: string; url: string }>("/api/admin/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ filename: file.name, contentType: file.type || "image/png", dataUrl }),
    });
    return res.url;
  }

  async function onSaveSite() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const skills = JSON.parse(skillsJson) as unknown;
      const projects = JSON.parse(projectsJson) as unknown;
      await api<{ ok: true }>("/api/admin/site", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ skills, projects }),
      });
      await reloadAll();
    } catch {
      setError("Site save failed. Make sure the JSON is valid.");
    } finally {
      setLoading(false);
    }
  }

  async function onSaveSkills() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      await api<{ ok: true }>("/api/admin/site", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ skills: siteSkills }),
      });
      await reloadAll();
    } catch {
      setError("Skills save failed. Validate fields and check server logs.");
    } finally {
      setLoading(false);
    }
  }

  async function onSaveProjects() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      await api<{ ok: true }>("/api/admin/site", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ projects: siteProjects }),
      });
      await reloadAll();
    } catch {
      setError("Projects save failed. Validate fields and check server logs.");
    } finally {
      setLoading(false);
    }
  }

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ token: string }>("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      setToken(data.token);
      setTokenState(data.token);
    } catch {
      setError("Invalid credentials.");
    } finally {
      setLoading(false);
    }
  }

  async function onSave() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      if (activeId) {
        await api<{ ok: true }>(`/api/admin/posts/${activeId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ title, excerpt, body, publishedAt }),
        });
      } else {
        await api<{ id: string }>("/api/admin/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ title, excerpt, body, publishedAt }),
        });
      }

      const data = await api<{ posts: AdminPost[] }>("/api/admin/posts", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPosts(data.posts);
      resetPostForm();
    } catch {
      setError("Save failed. Validate fields and check server logs.");
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(id: string) {
    if (!token) return;
    if (!confirm("Delete this post?")) return;
    setLoading(true);
    setError(null);
    try {
      await api<{ ok: true }>(`/api/admin/posts/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await api<{ posts: AdminPost[] }>("/api/admin/posts", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPosts(data.posts);
      resetPostForm();
    } catch {
      setError("Delete failed.");
    } finally {
      setLoading(false);
    }
  }

  function onUpsertSkillGroup() {
    const name = skillGroupName.trim();
    if (!name) {
      setError("Group name is required.");
      return;
    }
    const items = Array.from(new Set(listFromText(skillItemsText))).slice(0, 60);
    setSiteSkills((prev) => {
      const next: Record<string, string[]> = { ...prev };
      if (activeSkillGroup && activeSkillGroup !== name) delete next[activeSkillGroup];
      next[name] = items;
      return next;
    });
    setActiveSkillGroup(name);
  }

  function onDeleteSkillGroup(group: string) {
    if (!confirm(`Delete skill group "${group}"?`)) return;
    setSiteSkills((prev) => {
      const next: Record<string, string[]> = { ...prev };
      delete next[group];
      return next;
    });
    resetSkillForm();
  }

  function onUpsertProject() {
    const slug = projSlug.trim();
    if (!slug) {
      setError("Project slug is required.");
      return;
    }

    const slugExists = siteProjects.some((p) => p.slug === slug && p.slug !== activeProjectSlug);
    if (slugExists) {
      setError("Project slug must be unique.");
      return;
    }

    const next: Project = {
      slug,
      title: projTitle.trim(),
      impactMetric: projImpactMetric.trim(),
      oneLiner: projOneLiner.trim(),
      role: projRole.trim(),
      tech: Array.from(new Set(listFromText(projTechText))).slice(0, 20),
      links: {
        ...(projLive.trim() ? { live: projLive.trim() } : {}),
        ...(projGithub.trim() ? { github: projGithub.trim() } : {}),
      },
      ...(projCoverImage.trim() ? { coverImage: projCoverImage.trim() } : {}),
      ...(projScreenshots.length ? { screenshots: projScreenshots.slice(0, 8) } : {}),
      ...(projHasCaseStudy
        ? {
            caseStudy: {
              problem: projProblem.trim(),
              constraints: listFromText(projConstraintsText).slice(0, 12),
              approach: listFromText(projApproachText).slice(0, 12),
              results: listFromText(projResultsText).slice(0, 12),
            },
          }
        : {}),
    };

    setSiteProjects((prev) => {
      const idx = prev.findIndex((p) => p.slug === activeProjectSlug);
      if (idx === -1) return [next, ...prev];
      const copy = prev.slice();
      copy[idx] = next;
      return copy;
    });
    setActiveProjectSlug(slug);
  }

  function onDeleteProject(slug: string) {
    if (!confirm(`Delete project "${slug}"?`)) return;
    setSiteProjects((prev) => prev.filter((p) => p.slug !== slug));
    resetProjectForm();
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.topbar}>
        <a className={styles.back} href="/">
          Back to site
        </a>
        {token ? (
          <button
            className={styles.logout}
            type="button"
            onClick={() => {
              setToken("");
              setTokenState("");
              resetPostForm();
              resetSkillForm();
              resetProjectForm();
              setPosts([]);
              setSiteSkills({});
              setSiteProjects([]);
            }}
          >
            Log out
          </button>
        ) : null}
      </div>

      <main className={styles.main}>
        <header className={styles.head}>
          <h1 className={styles.h1}>Admin</h1>
          <p className={styles.sub}>Manage posts, skills, and projects stored in MongoDB.</p>
        </header>

        {error ? <div className={styles.error}>{error}</div> : null}

        {!token ? (
          <form className={styles.card} onSubmit={onLogin}>
            <h2 className={styles.h2}>Login</h2>
            <label className={styles.label}>
              Email
              <input className={styles.input} value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className={styles.label}>
              Password
              <input className={styles.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <button className={styles.primary} type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
            <p className={styles.mini}>Credentials come from server env vars: ADMIN_EMAIL and ADMIN_PASSWORD.</p>
          </form>
        ) : (
          <div className={styles.grid}>
            <section className={styles.card}>
              <div className={styles.row}>
                <h2 className={styles.h2}>Admin</h2>
              </div>
              <div className={styles.tabs} role="tablist" aria-label="Admin sections">
                <button
                  type="button"
                  className={[styles.tab, tab === "posts" ? styles.tabActive : ""].join(" ")}
                  onClick={() => setTab("posts")}
                >
                  Posts
                </button>
                <button
                  type="button"
                  className={[styles.tab, tab === "skills" ? styles.tabActive : ""].join(" ")}
                  onClick={() => setTab("skills")}
                >
                  Skills
                </button>
                <button
                  type="button"
                  className={[styles.tab, tab === "projects" ? styles.tabActive : ""].join(" ")}
                  onClick={() => setTab("projects")}
                >
                  Projects
                </button>
                <button
                  type="button"
                  className={[styles.tab, tab === "json" ? styles.tabActive : ""].join(" ")}
                  onClick={() => setTab("json")}
                >
                  Advanced JSON
                </button>
              </div>

              {tab === "posts" ? (
                <>
                  <div className={styles.row}>
                    <h3 className={styles.h3}>Posts</h3>
                    <button className={styles.secondary} type="button" onClick={resetPostForm} disabled={loading}>
                      New
                    </button>
                  </div>
                  <div className={styles.list}>
                    {posts.length === 0 ? <div className={styles.mini}>No posts yet.</div> : null}
                    {posts.map((p) => (
                      <div key={p.id} className={styles.item}>
                        <button
                          className={styles.itemBtn}
                          type="button"
                          onClick={() => setActiveId(p.id)}
                          disabled={loading}
                        >
                          <div className={styles.itemTitle}>{p.title}</div>
                          <div className={styles.itemMeta}>
                            {p.publishedAt} - {p.excerpt}
                          </div>
                        </button>
                        <button className={styles.danger} type="button" onClick={() => onDelete(p.id)} disabled={loading}>
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : tab === "skills" ? (
                <>
                  <div className={styles.row}>
                    <h3 className={styles.h3}>Skill groups</h3>
                    <div className={styles.actions}>
                      <button className={styles.secondary} type="button" onClick={resetSkillForm} disabled={loading}>
                        New
                      </button>
                      <button className={styles.primary} type="button" onClick={onSaveSkills} disabled={loading}>
                        {loading ? "Saving..." : "Save skills"}
                      </button>
                    </div>
                  </div>
                  <div className={styles.list}>
                    {Object.keys(siteSkills).length === 0 ? <div className={styles.mini}>No skill groups yet.</div> : null}
                    {Object.keys(siteSkills)
                      .sort((a, b) => a.localeCompare(b))
                      .map((group) => (
                        <div key={group} className={styles.item}>
                          <button
                            className={styles.itemBtn}
                            type="button"
                            onClick={() => setActiveSkillGroup(group)}
                            disabled={loading}
                          >
                            <div className={styles.itemTitle}>{group}</div>
                            <div className={styles.itemMeta}>{(siteSkills[group] ?? []).length} items</div>
                          </button>
                          <button
                            className={styles.danger}
                            type="button"
                            onClick={() => onDeleteSkillGroup(group)}
                            disabled={loading}
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                  </div>
                </>
              ) : tab === "projects" ? (
                <>
                  <div className={styles.row}>
                    <h3 className={styles.h3}>Projects</h3>
                    <div className={styles.actions}>
                      <button className={styles.secondary} type="button" onClick={resetProjectForm} disabled={loading}>
                        New
                      </button>
                      <button className={styles.primary} type="button" onClick={onSaveProjects} disabled={loading}>
                        {loading ? "Saving..." : "Save projects"}
                      </button>
                    </div>
                  </div>
                  <div className={styles.list}>
                    {siteProjects.length === 0 ? <div className={styles.mini}>No projects yet.</div> : null}
                    {siteProjects.map((p) => (
                      <div key={p.slug} className={styles.item}>
                        <button
                          className={styles.itemBtn}
                          type="button"
                          onClick={() => setActiveProjectSlug(p.slug)}
                          disabled={loading}
                        >
                          <div className={styles.itemTitle}>{p.title}</div>
                          <div className={styles.itemMeta}>
                            {p.slug} • {p.tech.length} tags
                          </div>
                        </button>
                        <button className={styles.danger} type="button" onClick={() => onDeleteProject(p.slug)} disabled={loading}>
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.row}>
                    <h3 className={styles.h3}>Raw site JSON</h3>
                    <button className={styles.primary} type="button" onClick={onSaveSite} disabled={loading}>
                      {loading ? "Saving..." : "Save site"}
                    </button>
                  </div>
                  <label className={styles.label}>
                    Skills JSON (object of groups)
                    <textarea
                      className={styles.textarea}
                      rows={10}
                      value={skillsJson}
                      onChange={(e) => setSkillsJson(e.target.value)}
                    />
                  </label>
                  <label className={styles.label}>
                    Projects JSON (array)
                    <textarea
                      className={styles.textarea}
                      rows={10}
                      value={projectsJson}
                      onChange={(e) => setProjectsJson(e.target.value)}
                    />
                  </label>
                </>
              )}
            </section>

            {tab === "posts" ? (
              <section className={styles.card}>
                <h2 className={styles.h2}>{activeId ? "Edit post" : "Create post"}</h2>
                <label className={styles.label}>
                  Title
                  <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} />
                </label>
                <label className={styles.label}>
                  Date
                  <input className={styles.input} type="date" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} />
                </label>
                <label className={styles.label}>
                  Excerpt
                  <textarea className={styles.textarea} rows={3} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
                </label>
                <label className={styles.label}>
                  Body
                  <textarea className={styles.textarea} rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
                </label>
                <div className={styles.actions}>
                  <button className={styles.primary} type="button" onClick={onSave} disabled={loading}>
                    {loading ? "Saving..." : "Save"}
                  </button>
                  {activeId ? (
                    <button className={styles.secondary} type="button" onClick={resetPostForm} disabled={loading}>
                      Cancel
                    </button>
                  ) : null}
                </div>
                <p className={styles.mini}>
                  API: <code>/api/posts</code> (public), <code>/api/site/*</code> (public), <code>/api/admin/*</code> (token).
                </p>
              </section>
            ) : tab === "skills" ? (
              <section className={styles.card}>
                <h2 className={styles.h2}>{activeSkillGroup ? "Edit skill group" : "Create skill group"}</h2>
                <label className={styles.label}>
                  Group name
                  <input className={styles.input} value={skillGroupName} onChange={(e) => setSkillGroupName(e.target.value)} />
                </label>
                <label className={styles.label}>
                  Items (one per line)
                  <textarea
                    className={styles.textarea}
                    rows={10}
                    value={skillItemsText}
                    onChange={(e) => setSkillItemsText(e.target.value)}
                  />
                </label>
                <div className={styles.actions}>
                  <button className={styles.primary} type="button" onClick={onUpsertSkillGroup} disabled={loading}>
                    {activeSkillGroup ? "Update group" : "Add group"}
                  </button>
                  {activeSkillGroup ? (
                    <button className={styles.secondary} type="button" onClick={resetSkillForm} disabled={loading}>
                      Cancel
                    </button>
                  ) : null}
                </div>
                <p className={styles.mini}>Tip: edit locally, then hit “Save skills” to persist to MongoDB.</p>
              </section>
            ) : tab === "projects" ? (
              <section className={styles.card}>
                <h2 className={styles.h2}>{activeProjectSlug ? "Edit project" : "Create project"}</h2>
                <label className={styles.label}>
                  Slug
                  <input className={styles.input} value={projSlug} onChange={(e) => setProjSlug(e.target.value)} />
                </label>
                <label className={styles.label}>
                  Title
                  <input className={styles.input} value={projTitle} onChange={(e) => setProjTitle(e.target.value)} />
                </label>
                <label className={styles.label}>
                  Impact metric
                  <input className={styles.input} value={projImpactMetric} onChange={(e) => setProjImpactMetric(e.target.value)} />
                </label>
                <label className={styles.label}>
                  One-liner
                  <textarea className={styles.textarea} rows={3} value={projOneLiner} onChange={(e) => setProjOneLiner(e.target.value)} />
                </label>
                <label className={styles.label}>
                  Role
                  <input className={styles.input} value={projRole} onChange={(e) => setProjRole(e.target.value)} />
                </label>
                <label className={styles.label}>
                  Tech tags (one per line)
                  <textarea className={styles.textarea} rows={5} value={projTechText} onChange={(e) => setProjTechText(e.target.value)} />
                </label>
                <label className={styles.label}>
                  Live URL (optional)
                  <input className={styles.input} value={projLive} onChange={(e) => setProjLive(e.target.value)} />
                </label>
                <label className={styles.label}>
                  GitHub URL (optional)
                  <input className={styles.input} value={projGithub} onChange={(e) => setProjGithub(e.target.value)} />
                </label>
                <label className={styles.label}>
                  Cover image URL (optional)
                  <input className={styles.input} value={projCoverImage} onChange={(e) => setProjCoverImage(e.target.value)} />
                </label>
                <label className={styles.label}>
                  Upload cover image (small screenshot)
                  <input
                    className={styles.input}
                    type="file"
                    accept="image/*"
                    disabled={loading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setLoading(true);
                      setError(null);
                      try {
                        const url = await uploadImage(file);
                        setProjCoverImage(url);
                      } catch {
                        setError("Cover upload failed. Keep it small (under ~900KB) and try again.");
                      } finally {
                        setLoading(false);
                        e.currentTarget.value = "";
                      }
                    }}
                  />
                </label>

                <div className={styles.row}>
                  <h3 className={styles.h3}>Screenshots</h3>
                  <input
                    className={styles.input}
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={loading}
                    onChange={async (e) => {
                      const files = Array.from(e.target.files ?? []);
                      if (files.length === 0) return;
                      setLoading(true);
                      setError(null);
                      try {
                        const next: { src: string; caption?: string }[] = [];
                        for (const f of files) {
                          const url = await uploadImage(f);
                          next.push({ src: url, caption: f.name.replace(/\.[^.]+$/, "") });
                        }
                        setProjScreenshots((prev) => [...prev, ...next].slice(0, 8));
                      } catch {
                        setError("Screenshot upload failed. Keep images small (under ~900KB) and try again.");
                      } finally {
                        setLoading(false);
                        e.currentTarget.value = "";
                      }
                    }}
                  />
                </div>

                {projScreenshots.length ? (
                  <div className={styles.thumbList} aria-label="Uploaded screenshots">
                    {projScreenshots.map((s, idx) => (
                      <div key={`${s.src}-${idx}`} className={styles.thumbRow}>
                        <div className={styles.thumb} aria-hidden="true">
                          <img className={styles.thumbImg} src={s.src} alt="" />
                        </div>
                        <input
                          className={styles.input}
                          value={s.caption ?? ""}
                          placeholder="Caption (optional)"
                          onChange={(e) => {
                            const v = e.target.value;
                            setProjScreenshots((prev) => {
                              const copy = prev.slice();
                              copy[idx] = { ...copy[idx], caption: v || undefined };
                              return copy;
                            });
                          }}
                        />
                        <button
                          className={styles.danger}
                          type="button"
                          disabled={loading}
                          onClick={() => setProjScreenshots((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.mini}>No screenshots yet. Upload 1 to 2 small images for the case study modal.</p>
                )}
                <label className={styles.mini}>
                  <input
                    type="checkbox"
                    checked={projHasCaseStudy}
                    onChange={(e) => setProjHasCaseStudy(e.target.checked)}
                    disabled={loading}
                  />{" "}
                  Include case study
                </label>
                {projHasCaseStudy ? (
                  <>
                    <label className={styles.label}>
                      Problem
                      <textarea className={styles.textarea} rows={4} value={projProblem} onChange={(e) => setProjProblem(e.target.value)} />
                    </label>
                    <label className={styles.label}>
                      Constraints (one per line)
                      <textarea
                        className={styles.textarea}
                        rows={4}
                        value={projConstraintsText}
                        onChange={(e) => setProjConstraintsText(e.target.value)}
                      />
                    </label>
                    <label className={styles.label}>
                      Approach (one per line)
                      <textarea
                        className={styles.textarea}
                        rows={4}
                        value={projApproachText}
                        onChange={(e) => setProjApproachText(e.target.value)}
                      />
                    </label>
                    <label className={styles.label}>
                      Results (one per line)
                      <textarea
                        className={styles.textarea}
                        rows={4}
                        value={projResultsText}
                        onChange={(e) => setProjResultsText(e.target.value)}
                      />
                    </label>
                  </>
                ) : null}
                <div className={styles.actions}>
                  <button className={styles.primary} type="button" onClick={onUpsertProject} disabled={loading}>
                    {activeProjectSlug ? "Update project" : "Add project"}
                  </button>
                  {activeProjectSlug ? (
                    <button className={styles.secondary} type="button" onClick={resetProjectForm} disabled={loading}>
                      Cancel
                    </button>
                  ) : null}
                </div>
                <p className={styles.mini}>Tip: edit locally, then hit “Save projects” to persist to MongoDB.</p>
              </section>
            ) : (
              <section className={styles.card}>
                <h2 className={styles.h2}>Expected shapes</h2>
                <p className={styles.mini}>
                  Skills: <code>{"{ \"Frontend\": [\"React\"], \"Backend\": [\"Node.js\"] }"}</code>
                </p>
                <p className={styles.mini}>
                  Projects: <code>{"[{ \"slug\": \"my-app\", \"title\": \"My App\", \"impactMetric\": \"...\", \"oneLiner\": \"...\", \"role\": \"...\", \"tech\": [\"React\"], \"links\": {\"github\": \"https://...\"} }]"}</code>
                </p>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
