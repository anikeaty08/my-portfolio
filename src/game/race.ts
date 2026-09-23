/** Live lap state, written by Gameplay and read by the HUD every frame (kept tiny so the HUD doesn't pull in physics). */
export const race = { running: false, start: 0, current: 0, last: null as number | null, best: null as number | null, next: 1 };
