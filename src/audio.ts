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
  const oceanGain = ctx.createGain();
  oceanGain.gain.value = 0.18;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.12;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.1;
  lfo.connect(lfoGain).connect(oceanGain.gain);
  lfo.start();
  noise.connect(ocean).connect(oceanGain).connect(master);
  noise.start();
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
