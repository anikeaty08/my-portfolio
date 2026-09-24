import { useEffect, useRef, useState, type FormEvent } from "react";
import { engage, stopAutopilot } from "../game/autopilot";
import { SUGGESTIONS } from "../game/planner";
import type { WorldData } from "../game/World";
import { getState, setState, useStore } from "../store";

/** Autopilot command bar: type where to go; the car plans a route and drives itself. */
export function PilotBar({ data }: { data: WorldData | null }) {
  const open = useStore((s) => s.pilotBar);
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest?.("input, textarea");
      if (e.code === "Tab" && !typing && getState().started && !getState().classic) {
        e.preventDefault();
        setState({ pilotBar: !getState().pilotBar, panel: null });
      } else if (e.code === "Escape" && getState().pilotBar) setState({ pilotBar: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 30);
  }, [open]);

  const go = (query: string) => {
    if (!data || !query.trim()) return;
    setState({ pilotBar: false, panel: null });
    setText("");
    input.current?.blur();
    engage(query, data);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    go(text);
  };

  if (!open) return null;
  return (
    <div className="pilot-bar" role="dialog" aria-label="Autopilot">
      <form onSubmit={submit}>
        <span className="pilot-bar__badge">AUTOPILOT</span>
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Where to? e.g. “something with MCP”"
          aria-label="Where should the car drive?"
        />
        <button className="btn btn--small btn--primary">Go</button>
      </form>
      <div className="pilot-bar__chips">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => go(s)}>
            {s}
          </button>
        ))}
      </div>
      <p className="pilot-bar__hint">The car plans a route on the roads and drives there itself. Touch any drive key to take over.</p>
    </div>
  );
}

/** Step-by-step trace of what the autopilot is doing. Fades a few seconds after it finishes. */
export function PilotTrace() {
  const pilot = useStore((s) => s.pilot);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!pilot.steps.length) return;
    setVisible(true);
    if (pilot.active) return;
    const t = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(t);
  }, [pilot]);
  if (!visible || !pilot.steps.length) return null;
  return (
    <div className="pilot-trace" aria-live="polite">
      <div className="pilot-trace__head">
        <span className={`pilot-trace__led ${pilot.active ? "is-on" : ""}`} />
        Autopilot {pilot.active ? "engaged" : "idle"}
        {pilot.active && (
          <button className="linkish" onClick={() => stopAutopilot("Cancelled")}>
            stop
          </button>
        )}
      </div>
      <ol>
        {pilot.steps.map((s, i) => (
          <li key={i} className={`is-${s.state}`}>
            {s.text}
          </li>
        ))}
      </ol>
    </div>
  );
}
