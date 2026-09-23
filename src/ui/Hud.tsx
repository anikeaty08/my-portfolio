import { useEffect, useRef, useState } from "react";
import { setSound } from "../audio";
import { person } from "../content";
import { input, setTouch, telemetry } from "../game/controls";
import { quality } from "../game/quality";
import type { WorldData } from "../game/World";
import { getState, setState, useStore } from "../store";
import { Moon, Reset, SoundOff, SoundOn, Sun } from "./icons";
import { zoneInfo } from "./Panels";

function TopBar() {
  const sound = useStore((s) => s.sound);
  const night = useStore((s) => s.night);
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand__mark" aria-hidden>
          AY
        </span>
        <div>
          <strong>{person.name}</strong>
          <span>{person.role} · Web3 · AI · Systems</span>
        </div>
      </div>
      <nav className="topbar__actions" aria-label="Settings">
        <button
          className={`icon-btn ${sound ? "is-on" : ""}`}
          onClick={() => {
            setState({ sound: !sound });
            void setSound(!sound);
          }}
          aria-pressed={sound}
          title="Sound (M)"
        >
          {sound ? <SoundOn /> : <SoundOff />}
        </button>
        <button className={`icon-btn ${night ? "is-on" : ""}`} onClick={() => setState({ night: !night })} aria-pressed={night} title="Day / night (N)">
          {night ? <Moon /> : <Sun />}
        </button>
        <button className="icon-btn" onClick={() => setState({ resetTick: getState().resetTick + 1 })} title="Reset car (R)">
          <Reset />
        </button>
        <button className="btn btn--small" onClick={() => setState({ classic: true, panel: null })}>
          Classic site
        </button>
        <a className="btn btn--small btn--primary" href="/resume.html" target="_blank" rel="noreferrer">
          Resume
        </a>
      </nav>
    </header>
  );
}

const QUICK: { id: string; label: string }[] = [
  { id: "project:polychat", label: "Projects" },
  { id: "about", label: "About" },
  { id: "skills", label: "Skills" },
  { id: "contact", label: "Contact" },
];

/** For visitors who'd rather read than drive. */
function QuickMenu() {
  return (
    <nav className="quick" aria-label="Jump to">
      <span>Jump to</span>
      {QUICK.map((q) => (
        <button key={q.id} onClick={() => setState({ panel: q.id })}>
          {q.label}
        </button>
      ))}
    </nav>
  );
}

function Hint() {
  const [visible, setVisible] = useState(true);
  const panel = useStore((s) => s.panel);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      if (performance.now() - start > 4000 && (input.throttle !== 0 || input.steer !== 0)) {
        setTimeout(() => setVisible(false), 2500);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className={`hint ${visible && !panel ? "" : "is-hidden"}`}>
      {quality.touch ? (
        <p>Drag the joystick to drive · roll onto the glowing pads</p>
      ) : (
        <p>
          <kbd>W</kbd>
          <kbd>A</kbd>
          <kbd>S</kbd>
          <kbd>D</kbd> drive · <kbd>Space</kbd> brake · <kbd>Shift</kbd> boost · <kbd>R</kbd> reset — roll onto the glowing pads
        </p>
      )}
    </div>
  );
}

function ZonePrompt() {
  const zone = useStore((s) => s.zone);
  const panel = useStore((s) => s.panel);
  if (!zone || panel) return null;
  const info = zoneInfo(zone);
  return (
    <button className="prompt" onClick={() => setState({ panel: zone })}>
      <span className="kicker">{info.kicker}</span>
      <strong>{info.title}</strong>
      <span className="prompt__cta">{quality.touch ? "Tap to open" : <><kbd>Enter</kbd> to open</>}</span>
    </button>
  );
}

function Minimap({ data }: { data: WorldData | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!data) return;
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const size = 150;
    const dpr = Math.min(2, window.devicePixelRatio);
    canvas.width = canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    const R = data.islandRadius + 5;
    const toMap = (x: number, z: number) => [size / 2 + (x / R) * (size / 2 - 6), size / 2 + (z / R) * (size / 2 - 6)] as const;
    const colors: Record<string, string> = { project: "#ff6b2c", about: "#ffd36b", skills: "#5ee6ff", contact: "#e2412f", lighthouse: "#ffffff" };
    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = "rgba(47,158,209,0.55)";
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#8ccb5e";
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, ((data.islandRadius) / R) * (size / 2 - 6), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#3b3f4b";
      ctx.lineWidth = (3.4 / R) * (size / 2 - 6);
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, (14.7 / R) * (size / 2 - 6), 0, Math.PI * 2);
      ctx.stroke();
      const zone = getState().zone;
      for (const z of data.zones) {
        const [x, y] = toMap(z.pos[0], z.pos[2]);
        ctx.fillStyle = colors[z.kind] ?? "#fff";
        ctx.beginPath();
        ctx.arc(x, y, z.id === zone ? 4.5 : 3, 0, Math.PI * 2);
        ctx.fill();
      }
      const [cx, cy] = toMap(telemetry.x, telemetry.z);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-telemetry.heading);
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(-4, 4);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-4, -4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [data]);
  return <canvas className="minimap" ref={ref} aria-hidden style={{ width: 150, height: 150 }} />;
}

/** Virtual joystick + brake for touch screens. */
function TouchControls() {
  const knob = useRef<HTMLDivElement>(null);
  const origin = useRef<{ x: number; y: number; id: number } | null>(null);
  const R = 48;

  const move = (x: number, y: number) => {
    if (!origin.current) return;
    let dx = x - origin.current.x;
    let dy = y - origin.current.y;
    const len = Math.hypot(dx, dy);
    if (len > R) {
      dx = (dx / len) * R;
      dy = (dy / len) * R;
    }
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
    setTouch({ throttle: Math.abs(dy) > 8 ? -dy / R : 0, steer: Math.abs(dx) > 8 ? -dx / R : 0 });
  };
  const end = () => {
    origin.current = null;
    if (knob.current) knob.current.style.transform = "";
    setTouch({ throttle: 0, steer: 0 });
  };

  return (
    <div className="touch">
      <div
        className="joystick"
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2, id: e.pointerId };
          e.currentTarget.setPointerCapture(e.pointerId);
          move(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => move(e.clientX, e.clientY)}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div className="joystick__knob" ref={knob} />
      </div>
      <button
        className="brake"
        onPointerDown={() => setTouch({ brake: true })}
        onPointerUp={() => setTouch({ brake: false })}
        onPointerCancel={() => setTouch({ brake: false })}
      >
        Brake
      </button>
    </div>
  );
}

export function Hud({ data }: { data: WorldData | null }) {
  return (
    <div className="hud">
      <TopBar />
      <Hint />
      <ZonePrompt />
      {!quality.touch && <Minimap data={data} />}
      <QuickMenu />
      {quality.touch && <TouchControls />}
    </div>
  );
}
