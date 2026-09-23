import { telemetry, input } from "./game/controls";

/**
 * Synthesized engine + ambience, no audio files: a detuned sawtooth pair through a low-pass
 * filter whose pitch follows the car's speed, over soft filtered-noise "ocean".
 */
let ctx: AudioContext | null = null;
let master: GainNode;
let engineA: OscillatorNode;
let engineB: OscillatorNode;
let engineGain: GainNode;
let engineFilter: BiquadFilterNode;
let raf = 0;
let oceanGain: GainNode;
let fireGain: GainNode;

/** World positions of positional sounds, set by the level. */
export const emitters = { fire: [0, 0] as [number, number], islandRadius: 38 };

function build() {
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  engineFilter = ctx.createBiquadFilter();
  engineFilter.type = "lowpass";
  engineFilter.frequency.value = 420;
  engineGain = ctx.createGain();
  engineGain.gain.value = 0.08;
  engineFilter.connect(engineGain).connect(master);
  engineA = ctx.createOscillator();
  engineB = ctx.createOscillator();
  engineA.type = engineB.type = "sawtooth";
  engineA.frequency.value = 42;
  engineB.frequency.value = 42.7;
  engineA.connect(engineFilter);
  engineB.connect(engineFilter);
  engineA.start();
  engineB.start();

  const len = ctx.sampleRate * 3;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = last * 3.5;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;
  const ocean = ctx.createBiquadFilter();
  ocean.type = "lowpass";
  ocean.frequency.value = 500;
  oceanGain = ctx.createGain();
  oceanGain.gain.value = 0.18;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.12;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.1;
  lfo.connect(lfoGain).connect(oceanGain.gain);
  lfo.start();
  noise.connect(ocean).connect(oceanGain).connect(master);
  noise.start();

  // Campfire: sparse random crackles in a looping buffer.
  const crackle = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const c = crackle.getChannelData(0);
  for (let i = 0; i < c.length; i++) c[i] = Math.random() < 0.0009 ? (Math.random() * 2 - 1) * 0.9 : (Math.random() * 2 - 1) * 0.015;
  const fire = ctx.createBufferSource();
  fire.buffer = crackle;
  fire.loop = true;
  const fireFilter = ctx.createBiquadFilter();
  fireFilter.type = "highpass";
  fireFilter.frequency.value = 900;
  fireGain = ctx.createGain();
  fireGain.gain.value = 0;
  fire.connect(fireFilter).connect(fireGain).connect(master);
  fire.start();
}

function update() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const speed = Math.min(Math.abs(telemetry.speed), 30);
  const rev = 42 + speed * 5.5 + Math.abs(input.throttle) * 10;
  engineA.frequency.setTargetAtTime(rev, t, 0.08);
  engineB.frequency.setTargetAtTime(rev * 1.017, t, 0.08);
  engineFilter.frequency.setTargetAtTime(380 + speed * 45 + Math.abs(input.throttle) * 250, t, 0.1);
  engineGain.gain.setTargetAtTime(0.05 + Math.min(speed / 30, 1) * 0.07 + Math.abs(input.throttle) * 0.03, t, 0.1);
  // Positional ambience: louder waves near the shore, crackles near the campfire.
  const r = Math.hypot(telemetry.x, telemetry.z);
  const shore = Math.min(1, Math.max(0, (r - 18) / (emitters.islandRadius - 14)));
  oceanGain.gain.setTargetAtTime(0.06 + shore * 0.3, t, 0.3);
  const df = Math.hypot(telemetry.x - emitters.fire[0], telemetry.z - emitters.fire[1]);
  fireGain.gain.setTargetAtTime(Math.max(0, 1 - df / 14) * 0.9, t, 0.2);
  raf = requestAnimationFrame(update);
}

export async function setSound(on: boolean) {
  if (on) {
    if (!ctx) build();
    await ctx!.resume();
    master.gain.setTargetAtTime(0.5, ctx!.currentTime, 0.5);
    cancelAnimationFrame(raf);
    update();
  } else if (ctx) {
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    cancelAnimationFrame(raf);
  }
}

/** A short thud when the car hits something. */
export function bump(strength: number) {
  if (!ctx || master.gain.value < 0.01) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
  g.gain.setValueAtTime(Math.min(0.5, strength * 0.05), t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.3);
}

function live() {
  return ctx && master.gain.value > 0.01 ? ctx : null;
}

function tone(type: OscillatorType, freq: number, start: number, dur: number, vol: number, dest: AudioNode) {
  const c = ctx!;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vol, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  o.connect(g).connect(dest);
  o.start(start);
  o.stop(start + dur + 0.05);
}

/** Two-tone toy-car horn. */
export function horn() {
  const c = live();
  if (!c) return;
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 1800;
  f.connect(master);
  const t = c.currentTime;
  tone("square", 392, t, 0.32, 0.12, f);
  tone("square", 494, t, 0.32, 0.1, f);
}

/** Little arpeggio for achievements. */
export function chime() {
  const c = live();
  if (!c) return;
  const t = c.currentTime;
  [1046.5, 1318.5, 1568, 2093].forEach((f, i) => tone("sine", f, t + i * 0.07, 0.5, 0.12, master));
}

/** Wooden clack for pins, crates and bricks. */
export function clack(strength: number) {
  const c = live();
  if (!c) return;
  const t = c.currentTime;
  const len = Math.floor(c.sampleRate * 0.08);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1400 + Math.random() * 900;
  bp.Q.value = 2.5;
  const g = c.createGain();
  g.gain.value = Math.min(0.45, 0.05 + strength * 0.04);
  src.connect(bp).connect(g).connect(master);
  src.start(t);
}

/** Splash when the car hits the sea. */
export function splash() {
  const c = live();
  if (!c) return;
  const t = c.currentTime;
  const len = Math.floor(c.sampleRate * 0.9);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const src = c.createBufferSource();
  src.buffer = buf;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(3000, t);
  lp.frequency.exponentialRampToValueAtTime(300, t + 0.8);
  const g = c.createGain();
  g.gain.value = 0.35;
  src.connect(lp).connect(g).connect(master);
  src.start(t);
}
