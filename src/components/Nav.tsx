import { useEffect, useState } from "react";
import { Mail, Menu, X } from "lucide-react";
import { profile } from "../data/content";

const links = [
  { href: "#top", label: "Home" },
  { href: "#focus", label: "About" },
  { href: "#experience", label: "Background" },
  { href: "#projects", label: "Projects" },
  { href: "#contact", label: "Contact" },
];

export function Nav({ onWrite: _onWrite, activeHash, isArticle }: { onWrite: () => void; activeHash: string; isArticle: boolean }) {
  const [time, setTime] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const update = () => setTime(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }).format(new Date()));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header className={`reference-header${isArticle ? " article-nav" : ""}`}>
      <nav className="reference-nav" aria-label="Primary">
        <div className="nav-location"><time>{time || "--:--:--"}</time><span>Bangalore, India</span></div>
        <div className="nav-links">{links.map((link) => <a key={link.href} href={isArticle ? `/${link.href}` : link.href} aria-current={!isArticle && (activeHash === link.href || (!activeHash && link.href === "#top")) ? "page" : undefined}>{link.label}</a>)}</div>
        <div className="nav-social">
          <a href={profile.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn"><span className="social-letters">in</span></a>
          <a href={profile.github} target="_blank" rel="noreferrer" aria-label="GitHub"><span className="social-letters">gh</span></a>
          <a href={`mailto:${profile.email}`} aria-label="Email"><Mail size={17} /></a>
        </div>
        <button className="nav-menu-button" type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? <X size={23} /> : <Menu size={23} />}</button>
      </nav>
      {open && <div className="mobile-menu">{links.map((link) => <a key={link.href} href={isArticle ? `/${link.href}` : link.href} onClick={() => setOpen(false)}>{link.label}</a>)}</div>}
    </header>
  );
}
