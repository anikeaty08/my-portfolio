import { Vector3 } from "three";

/**
 * Driver input, merged from keyboard and the on-screen touch controls.
 * Values are read every physics frame; nothing here triggers React renders.
 */
export const input = {
  throttle: 0, // -1 (reverse) .. 1
  steer: 0, // -1 (right) .. 1 (left)
  brake: false,
  boost: false,
};

const keys = new Set<string>();
const touch = { throttle: 0, steer: 0, brake: false };
const pad = { throttle: 0, steer: 0, brake: false, boost: false, horn: false };

function recompute() {
  const up = keys.has("KeyW") || keys.has("ArrowUp");
  const down = keys.has("KeyS") || keys.has("ArrowDown");
  const left = keys.has("KeyA") || keys.has("ArrowLeft");
  const right = keys.has("KeyD") || keys.has("ArrowRight");
  const kThrottle = (up ? 1 : 0) - (down ? 1 : 0);
  const kSteer = (left ? 1 : 0) - (right ? 1 : 0);
  input.throttle = kThrottle || touch.throttle || pad.throttle;
  input.steer = kSteer || touch.steer || pad.steer;
  input.brake = keys.has("Space") || touch.brake || pad.brake;
  input.boost = keys.has("ShiftLeft") || keys.has("ShiftRight") || pad.boost;
}

export function setTouch(patch: Partial<typeof touch>) {
  Object.assign(touch, patch);
  recompute();
}

const DRIVE_KEYS = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "ShiftLeft", "ShiftRight"];

/** Returns a cleanup. `onKey` gets non-driving key presses (Enter, R, N, Escape…). */
export function bindKeyboard(onKey: (code: string) => void) {
  const typing = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    return t?.closest("input, textarea, select, [contenteditable]") != null;
  };
  const down = (e: KeyboardEvent) => {
    if (typing(e)) return;
    if (DRIVE_KEYS.includes(e.code)) {
      e.preventDefault();
      keys.add(e.code);
      recompute();
    }
    if (!e.repeat) onKey(e.code);
  };
  const up = (e: KeyboardEvent) => {
    keys.delete(e.code);
    recompute();
  };
  const blur = () => {
    keys.clear();
    recompute();
  };
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", blur);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", blur);
  };
}

/** Live telemetry from the car, for sound, effects and HUD. */
export const telemetry = {
  speed: 0,
  x: 0,
  y: 0,
  z: 0,
  vx: 0,
  vz: 0,
  heading: 0,
  wheels: [0, 1, 2, 3].map(() => ({ contact: false, pos: new Vector3(), slip: 0 })),
};

/**
 * Standard-mapping gamepad: left stick steers, RT drives, LT reverses,
 * A brakes, X boosts, B honks. Returns true on the frame the horn button goes down.
 */
let hornWasDown = false;
export function pollGamepad(): boolean {
  const gp = navigator.getGamepads?.().find((g) => g && g.mapping === "standard");
  if (!gp) return false;
  const dead = (v: number) => (Math.abs(v) < 0.15 ? 0 : v);
  pad.steer = -dead(gp.axes[0] ?? 0);
  pad.throttle = (gp.buttons[7]?.value ?? 0) - (gp.buttons[6]?.value ?? 0);
  pad.brake = Boolean(gp.buttons[0]?.pressed);
  pad.boost = Boolean(gp.buttons[2]?.pressed);
  const horn = Boolean(gp.buttons[1]?.pressed);
  const pressed = horn && !hornWasDown;
  hornWasDown = horn;
  recompute();
  return pressed;
}
