/**
 * Shared, clock-driven world signals so the renderer and the autopilot agree on them.
 * Traffic light cycle: green 3 s, amber 1 s, red 3 s.
 */
export function lightPhase(t: number) {
  return t % 7;
}
export function lightIsRed(t: number) {
  return lightPhase(t) >= 3; // amber counts as stop for a careful driver
}

/** NPC car positions (three.js x/z), written by Traffic every frame. */
export const npcs: { x: number; z: number; thought: string }[] = [];
