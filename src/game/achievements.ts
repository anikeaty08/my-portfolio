import { chime } from "../audio";
import { setState, getState } from "../store";

export type Achievement = { id: string; title: string; hint: string };

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-drive", title: "Turn the key", hint: "Drive the car for the first time" },
  { id: "vandal", title: "Name dropper", hint: "Knock over the letters of my name" },
  { id: "cones", title: "Cone zone", hint: "Scatter all the traffic cones" },
  { id: "crates", title: "Special delivery", hint: "Topple the crate stack" },
  { id: "wall", title: "Another brick", hint: "Smash through the brick wall" },
  { id: "skills", title: "Stack overflow", hint: "Knock down the skill blocks" },
  { id: "strike", title: "Strike!", hint: "Knock down all ten pins" },
  { id: "lap", title: "Lap of honour", hint: "Complete a lap of the ring road" },
  { id: "fast-lap", title: "Speed demon", hint: "Complete a lap in under 14 seconds" },
  { id: "splash", title: "Splash", hint: "Drive into the sea" },
  { id: "night", title: "Night owl", hint: "Switch off the sun" },
  { id: "horn", title: "Beep beep", hint: "Honk the horn" },
  { id: "projects", title: "Curious recruiter", hint: "Open every project" },
  { id: "explorer", title: "Explorer", hint: "Visit About, Skills and Contact" },
  { id: "eggs", title: "Egg hunter", hint: "Find all three golden eggs" },
  { id: "konami", title: "Old school", hint: "↑ ↑ ↓ ↓ ← → ← → B A" },
];

/** Paint jobs, unlocked by how many achievements you have. */
export const SKINS = [
  { id: "orange", name: "Signature", color: "#ff6b2c", need: 0 },
  { id: "mint", name: "Mint", color: "#3ddc97", need: 2 },
  { id: "royal", name: "Royal", color: "#4f6bff", need: 4 },
  { id: "bubblegum", name: "Bubblegum", color: "#ff5fa2", need: 6 },
  { id: "noir", name: "Noir", color: "#23252d", need: 9 },
  { id: "gold", name: "24 carat", color: "#ffcf4a", need: 13 },
];

const KEY = "island-progress-v1";

type Progress = { unlocked: Record<string, number>; seen: string[]; eggs: number[]; bestLap: number | null; skin: string };

function load(): Progress {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { unlocked: p.unlocked ?? {}, seen: p.seen ?? [], eggs: p.eggs ?? [], bestLap: p.bestLap ?? null, skin: p.skin ?? "orange" };
  } catch {
    return { unlocked: {}, seen: [], eggs: [], bestLap: null, skin: "orange" };
  }
}

export const progress = load();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    /* storage unavailable: progress lasts for this visit only */
  }
}

export function unlock(id: string) {
  if (progress.unlocked[id]) return;
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) return;
  progress.unlocked[id] = Date.now();
  save();
  chime();
  const count = Object.keys(progress.unlocked).length;
  const skin = SKINS.find((s) => s.need === count);
  setState({
    toast: { key: Date.now(), title: a.title, body: skin ? `New paint job unlocked: ${skin.name}` : a.hint },
    achievements: count,
  });
}

/** Records that a zone's panel was opened; unlocks the "visit everything" achievements. */
export function markSeen(zone: string) {
  if (!progress.seen.includes(zone)) {
    progress.seen.push(zone);
    save();
  }
  const projects = progress.seen.filter((z) => z.startsWith("project:")).length;
  if (projects >= 6) unlock("projects");
  if (["about", "skills", "contact"].every((z) => progress.seen.includes(z))) unlock("explorer");
}

export function collectEgg(i: number) {
  if (progress.eggs.includes(i)) return false;
  progress.eggs.push(i);
  save();
  setState({ eggs: progress.eggs.length, toast: { key: Date.now(), title: `Golden egg ${progress.eggs.length} / 3`, body: progress.eggs.length < 3 ? "Keep looking…" : "All found!" } });
  chime();
  if (progress.eggs.length >= 3) unlock("eggs");
  return true;
}

export function recordLap(seconds: number) {
  const best = progress.bestLap === null || seconds < progress.bestLap;
  if (best) {
    progress.bestLap = seconds;
    save();
  }
  unlock("lap");
  if (seconds < 14) unlock("fast-lap");
  return best;
}

export function setSkin(id: string) {
  const skin = SKINS.find((s) => s.id === id);
  if (!skin || Object.keys(progress.unlocked).length < skin.need) return;
  progress.skin = id;
  save();
  setState({ skin: id });
}

export function unlockedCount() {
  return Object.keys(progress.unlocked).length;
}

export function isUnlocked(id: string) {
  return Boolean(progress.unlocked[id]);
}

/** ↑ ↑ ↓ ↓ ← → ← → B A */
const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "KeyB", "KeyA"];
let konamiAt = 0;
export function trackKonami(code: string) {
  konamiAt = code === KONAMI[konamiAt] ? konamiAt + 1 : code === KONAMI[0] ? 1 : 0;
  if (konamiAt === KONAMI.length) {
    konamiAt = 0;
    unlock("konami");
    setState({ moon: !getState().moon, toast: { key: Date.now(), title: getState().moon ? "Moon gravity: on" : "Moon gravity: off", body: "Enter the code again to toggle" } });
  }
}
