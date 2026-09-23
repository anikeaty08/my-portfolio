/**
 * The fall, in units of the Schwarzschild radius. Distance shrinks exponentially with
 * scroll so every screenful of scrolling feels like the same "speed" of falling.
 */
export const ORBIT_R = 24;
const END_R = 0.9;

export function fallRadius(dive: number, orbit = ORBIT_R) {
  return orbit * Math.pow(END_R / orbit, dive);
}

/** Gravitational time dilation for a static observer: dτ/dt = sqrt(1 - r_s/r). */
export function timeDilation(r: number) {
  return r <= 1 ? Infinity : 1 / Math.sqrt(1 - 1 / r);
}

/** Free-fall speed from rest at infinity, as a fraction of c: v = sqrt(r_s/r). */
export function fallSpeed(r: number) {
  return Math.min(1, Math.sqrt(1 / r));
}

export const milestones = [
  { from: 0.1, to: 0.3, label: "Leaving orbit", body: "Scroll is gravity now. There's no way back up — only through." },
  { from: 0.5, to: 0.66, label: "r = 3 rₛ · Innermost stable orbit", body: "Nothing can orbit this close. The disk is spilling in with you." },
  { from: 0.76, to: 0.87, label: "r = 1.5 rₛ · Photon sphere", body: "Light itself is circling the hole. Look close — that ring is the back of the universe." },
  { from: 0.9, to: 0.965, label: "Event horizon", body: "Every path now leads to the work." },
];
