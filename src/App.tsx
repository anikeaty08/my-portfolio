import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { about, person, posts, projects, resumeLinks, sectionOrder, socials, type Accent, experience, skills } from "./content";
import { Background } from "./components/Background";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { Projects } from "./components/Projects";
import { About } from "./components/About";
import { Experience } from "./components/Experience";
import { Skills } from "./components/Skills";
import { Resume } from "./components/Resume";
import { Writing } from "./components/Writing";
import { Contact } from "./components/Contact";
import { CaseStudyModal } from "./components/CaseStudyModal";
import { CommandPalette, type PaletteAction } from "./components/CommandPalette";
import { AdminPage } from "./pages/AdminPage";
import { usePrefersReducedMotion } from "./hooks/usePrefersReducedMotion";
import { useLocalStorageState } from "./hooks/useLocalStorageState";
import { useKeyCombo } from "./hooks/useKeyCombo";
import styles from "./styles/App.module.css";

function scrollToId(id: string, reducedMotion: boolean) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
}

export function App() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

  const prefersReducedMotion = usePrefersReducedMotion();
  const [motionSetting, setMotionSetting] = useLocalStorageState<"system" | "reduced" | "full">(
    "motion",
    "full",
  );
  const reducedMotion = motionSetting === "system" ? prefersReducedMotion : motionSetting === "reduced";

  const [accent, setAccent] = useLocalStorageState<Accent>("accent", "acid");

  const [projectList, setProjectList] = useState(projects);
  const [activeProjectSlug, setActiveProjectSlug] = useState<string | null>(null);
  const activeProject = useMemo(
    () => projectList.find((p) => p.slug === activeProjectSlug) ?? null,
    [activeProjectSlug, projectList],
  );

  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  useEffect(() => {
    document.documentElement.dataset.motion = reducedMotion ? "reduced" : "full";
  }, [reducedMotion]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/site/projects")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || cancelled) return;
        if (Array.isArray(data.projects) && data.projects.length > 0) setProjectList(data.projects);
      })
      .catch(() => {
        // ignore; fallback to static projects
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useKeyCombo(
    {
      key: "k",
      metaKey: true,
    },
    () => setPaletteOpen(true),
    { enabled: !isAdmin },
  );

  useKeyCombo(
    {
      key: "k",
      ctrlKey: true,
    },
    () => setPaletteOpen(true),
    { enabled: !isAdmin },
  );

  const paletteActions: PaletteAction[] = useMemo(() => {
    const jumpActions: PaletteAction[] = sectionOrder.map((s) => ({
      id: `jump:${s.id}`,
      label: `Jump to ${s.label}`,
      group: "Jump",
      keywords: [s.id, s.label],
      run: () => scrollToId(s.id, reducedMotion),
    }));

    const linkActions: PaletteAction[] = [
      {
        id: "link:github",
        label: "Open GitHub",
        group: "Links",
        keywords: ["github"],
        run: () => window.open(socials.github, "_blank", "noopener,noreferrer"),
      },
      {
        id: "link:resume",
        label: "Open Resume (printable)",
        group: "Links",
        keywords: ["resume", "cv"],
        run: () => window.open(resumeLinks.html, "_blank", "noopener,noreferrer"),
      },
      {
        id: "link:resume-pdf",
        label: "Download Resume (PDF)",
        group: "Links",
        keywords: ["resume", "cv", "pdf"],
        run: () => window.open(resumeLinks.pdf, "_blank", "noopener,noreferrer"),
      },
      ...(socials.linkedin
        ? ([
            {
              id: "link:linkedin",
              label: "Open LinkedIn",
              group: "Links",
              keywords: ["linkedin"],
              run: () => window.open(socials.linkedin!, "_blank", "noopener,noreferrer"),
            },
          ] as const)
        : []),
      ...(socials.x
        ? ([
            {
              id: "link:x",
              label: "Open X",
              group: "Links",
              keywords: ["x", "twitter"],
              run: () => window.open(socials.x!, "_blank", "noopener,noreferrer"),
            },
          ] as const)
        : []),
      ...(socials.website
        ? ([
            {
              id: "link:website",
              label: "Open Website",
              group: "Links",
              keywords: ["website", "blog"],
              run: () => window.open(socials.website!, "_blank", "noopener,noreferrer"),
            },
          ] as const)
        : []),
      ...(socials.email
        ? ([
            {
              id: "link:email",
              label: "Email",
              group: "Links",
              keywords: ["email", "contact"],
              run: () => (window.location.href = `mailto:${socials.email}`),
            },
          ] as const)
        : []),
    ];

    const toggleActions: PaletteAction[] = [
      {
        id: "toggle:motion",
        label: reducedMotion ? "Set motion: full" : "Set motion: reduced",
        group: "Toggles",
        keywords: ["motion", "reduced", "animation"],
        run: () => setMotionSetting(reducedMotion ? "full" : "reduced"),
      },
      {
        id: "toggle:accent",
        label: accent === "acid" ? "Accent: ember" : "Accent: acid",
        group: "Toggles",
        keywords: ["accent", "theme", "color"],
        run: () => setAccent(accent === "acid" ? "ember" : "acid"),
      },
    ];

    return [...jumpActions, ...linkActions, ...toggleActions];
  }, [accent, reducedMotion, setAccent, setMotionSetting]);

  const home = (
    <div className={styles.app}>
      <a className={styles.skipLink} href="#work">
        Skip to work
      </a>
      <Background reducedMotion={reducedMotion} />
      <Header name={person.name} onOpenPalette={() => setPaletteOpen(true)} reducedMotion={reducedMotion} />

      <main className={styles.main} id="top">
        <Hero
          person={person}
          onViewWork={() => scrollToId("work", reducedMotion)}
          onContact={() => scrollToId("contact", reducedMotion)}
        />
        <Projects projects={projectList} onOpenCaseStudy={(slug) => setActiveProjectSlug(slug)} />
        <About about={about} />
        <Experience items={experience} />
        <Skills groups={skills} />
        <Resume />
        <Writing posts={posts} />
        <Contact socials={socials} />
        <footer className={styles.footer}>
          <div className={styles.footerGrid}>
            <div className={styles.footerMark}>
              <span className={styles.footerName}>{person.name}</span>
              <span className={styles.footerMeta}>Built with React + Vite - Editorial Brutalism</span>
            </div>
            <div className={styles.footerLinks}>
              <a href={socials.github} target="_blank" rel="noreferrer">
                GitHub
              </a>
              {socials.linkedin ? (
                <a href={socials.linkedin} target="_blank" rel="noreferrer">
                  LinkedIn
                </a>
              ) : null}
              {socials.email ? <a href={`mailto:${socials.email}`}>Email</a> : null}
            </div>
          </div>
        </footer>
      </main>

      <CaseStudyModal project={activeProject} onClose={() => setActiveProjectSlug(null)} />
      <CommandPalette open={paletteOpen} actions={paletteActions} onClose={() => setPaletteOpen(false)} />
    </div>
  );

  return (
    <Routes>
      <Route path="/" element={home} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
