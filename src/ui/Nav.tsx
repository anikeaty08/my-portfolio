import { setSound } from "../audio";
import { person } from "../content";
import { scrollToId } from "../scroll";
import { setState, useStore } from "../store";

const links = [
  { id: "descent", label: "Horizon" },
  { id: "work", label: "Work" },
  { id: "about", label: "About" },
  { id: "contact", label: "Contact" },
];

export function Nav() {
  const sound = useStore((s) => s.sound);
  const toggle = () => {
    setState({ sound: !sound });
    void setSound(!sound);
  };
  return (
    <header className="nav">
      <button className="nav__logo" onClick={() => scrollToId("descent")} aria-label={`${person.name}, back to top`}>
        <span className="nav__mark" aria-hidden />
        AY
      </button>
      <nav className="nav__links" aria-label="Sections">
        {links.map((l) => (
          <button key={l.id} onClick={() => scrollToId(l.id)} className="mono">
            {l.label}
          </button>
        ))}
      </nav>
      <div className="nav__right">
        <button className={`nav__sound ${sound ? "is-on" : ""}`} onClick={toggle} aria-pressed={sound} aria-label="Toggle sound">
          <span />
          <span />
          <span />
          <span />
        </button>
        <a className="mono nav__resume" href="/resume.html" target="_blank" rel="noreferrer">
          Resume ↗
        </a>
      </div>
    </header>
  );
}
