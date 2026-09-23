import { scroll } from "./scroll";

/**
 * A synthesized drone, no audio files. Its pitch drops as you fall — gravitational redshift —
 * and a filtered-noise "wind" opens up with scroll speed.
 */
let ctx: AudioContext | null = null;
let master: GainNode;
let oscs: OscillatorNode[] = [];
let wind: BiquadFilterNode;
let raf = 0;

const BASE = [55, 55.35, 82.4, 110];

function build() {
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp).connect(ctx.destination);

  oscs = BASE.map((f, i) => {
    const o = ctx!.createOscillator();
    o.type = i === 3 ? "triangle" : "sine";
    o.frequency.value = f;
    const g = ctx!.createGain();
    g.gain.value = [0.32, 0.32, 0.12, 0.05][i];
    o.connect(g).connect(master);
    o.start();
    return o;
  });

  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; // brown noise
    data[i] = last * 3.5;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;
  wind = ctx.createBiquadFilter();
  wind.type = "bandpass";
  wind.Q.value = 0.8;
  const wg = ctx.createGain();
  wg.gain.value = 0.5;
  noise.connect(wind).connect(wg).connect(master);
  noise.start();
}

function update() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const redshift = 1 - 0.45 * Math.pow(scroll.dive < 0.99 ? scroll.dive : 0, 2);
  oscs.forEach((o, i) => o.frequency.setTargetAtTime(BASE[i] * redshift, t, 0.15));
  const speed = Math.min(Math.abs(scroll.velocity), 80);
  wind.frequency.setTargetAtTime(180 + scroll.dive * 700 + speed * 25, t, 0.2);
  raf = requestAnimationFrame(update);
}

export async function setSound(on: boolean) {
  if (on) {
    if (!ctx) build();
    await ctx!.resume();
    master.gain.setTargetAtTime(0.22, ctx!.currentTime, 0.8);
    cancelAnimationFrame(raf);
    update();
  } else if (ctx) {
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
    cancelAnimationFrame(raf);
  }
}
