/**
 * Real-time Schwarzschild black hole, ray traced per pixel.
 *
 * Units: Schwarzschild radius r_s = 1. Each ray is integrated as a null geodesic using the
 * classic Newtonian-form trick  a = -1.5 * h² * x / |x|⁵  (h = |x × v|, conserved), which
 * reproduces light bending, the photon ring and the shadow. Every time a ray crosses the
 * equatorial plane inside the disk radii it picks up emission from a thin, turbulent,
 * Keplerian accretion disk with relativistic Doppler beaming. Rays that escape sample a
 * procedural starfield, nebula, and the name texture — so the name itself gets lensed.
 */

export const blackholeVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const blackholeFragment = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform vec2  uRes;
uniform float uDist;        // camera distance from the singularity
uniform float uElev;        // camera elevation above the disk plane (radians)
uniform float uAzim;        // camera azimuth (radians)
uniform float uRoll;
uniform float uFocal;       // focal length; smaller = wider, faster-feeling
uniform float uSteps;       // quality: max integration steps
uniform vec2  uCursor;      // cursor in page uv (0..1)
uniform float uCursorMass;  // strength of the cursor's mini lens
uniform float uFade;        // 0..1 fade to black at the horizon
uniform sampler2D uText;
uniform float uTextAspect;

#define MAX_STEPS 220
#define DISK_IN 2.4
#define DISK_OUT 13.0

// ---------------------------------------------------------------- noise
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y),
    f.z);
}

float fbm(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; }
  return v;
}

// ---------------------------------------------------------------- sky
vec3 stars(vec3 d) {
  vec3 col = vec3(0.0);
  for (int layer = 0; layer < 3; layer++) {
    float scale = 90.0 + float(layer) * 110.0;
    vec3 p = d * scale;
    vec3 cell = floor(p);
    float h = hash13(cell + float(layer) * 17.0);
    if (h > 0.965) {
      vec3 center = cell + vec3(hash13(cell + 1.3), hash13(cell + 2.7), hash13(cell + 4.1));
      float dist = length(p - center);
      float b = pow(max(0.0, 1.0 - dist * 1.6), 6.0) * (h - 0.965) * 60.0;
      float tw = 0.75 + 0.25 * sin(uTime * (1.0 + h * 3.0) + h * 40.0);
      vec3 tint = mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.85, 0.7), hash13(cell + 9.0));
      col += tint * b * tw;
    }
  }
  return col;
}

vec3 nebula(vec3 d) {
  float n = fbm(d * 2.2 + vec3(0.0, 0.0, uTime * 0.01));
  float m = fbm(d * 4.0 - 3.0);
  vec3 a = vec3(0.16, 0.05, 0.28) * smoothstep(0.45, 0.85, n);
  vec3 b = vec3(0.02, 0.10, 0.22) * smoothstep(0.5, 0.9, m);
  return (a + b) * 0.55;
}

// The name hangs on a far plane behind the hole (world -Z), so it is lensed like everything else.
vec3 nameLayer(vec3 d) {
  if (d.z > -0.05) return vec3(0.0);
  vec2 p = d.xy / -d.z;
  float w = 0.5;
  vec2 uv = vec2(p.x / w + 0.5, (p.y + 0.3) / (w / uTextAspect) + 0.5);
  float a = texture2D(uText, uv).r;
  return vec3(1.0, 0.95, 0.88) * a * 0.75;
}

vec3 background(vec3 d) {
  return stars(d) + nebula(d) + nameLayer(d);
}

// ---------------------------------------------------------------- accretion disk
vec4 disk(vec3 p, vec3 rayDir) {
  float r = length(p.xz);
  if (r < DISK_IN || r > DISK_OUT) return vec4(0.0);

  // Keplerian shear: inner rings orbit faster.
  float omega = 1.6 / pow(r, 1.5);
  float a = uTime * omega;
  vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;

  float turb = fbm(vec3(q * 0.9, r * 0.35));
  float streaks = fbm(vec3(q * 2.8, r * 1.7) + 7.0);
  float density = smoothstep(DISK_IN, DISK_IN + 0.5, r) * (1.0 - smoothstep(DISK_OUT - 6.0, DISK_OUT, r));
  density *= 0.35 + 0.9 * turb * (0.6 + 0.6 * streaks);

  // Temperature profile T ∝ r^-3/4.
  float t = pow(DISK_IN / r, 0.75);
  vec3 hot = vec3(1.0, 0.93, 0.82);
  vec3 mid = vec3(1.0, 0.55, 0.18);
  vec3 cold = vec3(0.55, 0.12, 0.04);
  vec3 col = mix(cold, mid, smoothstep(0.25, 0.6, t));
  col = mix(col, hot, smoothstep(0.6, 1.0, t));

  // Relativistic Doppler beaming: the side moving toward us is brighter and bluer.
  vec3 vel = normalize(vec3(-p.z, 0.0, p.x)) * sqrt(0.5 / r);
  float beta = length(vel);
  float gamma = 1.0 / sqrt(1.0 - beta * beta);
  float cosT = dot(normalize(vel), -normalize(rayDir));
  float D = 1.0 / (gamma * (1.0 - beta * cosT));
  float boost = clamp(pow(D, 3.0), 0.12, 6.0);
  col = mix(col, col * vec3(0.75, 0.9, 1.35), clamp(D - 1.0, 0.0, 1.0));

  float intensity = t * t * 5.5 * boost;
  float alpha = clamp(density * 1.15, 0.0, 1.0);
  return vec4(col * intensity * density, alpha);
}

// ---------------------------------------------------------------- main
void main() {
  vec2 frag = vUv * uRes;
  vec2 uv = (frag - 0.5 * uRes) / uRes.y;

  // Cursor mini-lens: a point mass in screen space (thin-lens equation β = θ - θE²/θ).
  vec2 cur = (uCursor * uRes - 0.5 * uRes) / uRes.y;
  vec2 dc = uv - cur;
  float lc = length(dc);
  float thetaE = 0.035 * uCursorMass;
  float cursorShadow = 0.0;
  if (uCursorMass > 0.001) {
    uv = cur + dc * (1.0 - (thetaE * thetaE) / max(lc * lc, 1e-5));
    cursorShadow = 1.0 - smoothstep(thetaE * 0.45, thetaE * 0.6, lc);
  }

  // Camera on a sphere around the hole, looking at the origin.
  vec3 cam = uDist * vec3(sin(uAzim) * cos(uElev), sin(uElev), cos(uAzim) * cos(uElev));
  vec3 fwd = normalize(-cam);
  vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, fwd);
  float cr = cos(uRoll), sr = sin(uRoll);
  vec3 r2 = right * cr + up * sr;
  vec3 u2 = up * cr - right * sr;
  vec3 dir = normalize(fwd * uFocal + uv.x * r2 + uv.y * u2);

  vec3 pos = cam;
  vec3 h = cross(pos, dir);
  float h2 = dot(h, h);

  vec3 acc = vec3(0.0);
  float accA = 0.0;
  bool captured = false;

  for (int i = 0; i < MAX_STEPS; i++) {
    if (float(i) >= uSteps) break;
    float r = length(pos);
    if (r < 1.0) { captured = true; break; }
    // Escaping and already past the disk: bending is negligible from here on.
    if (r > DISK_OUT + 3.0 && dot(pos, dir) > 0.0) break;

    float dt = clamp((r - 0.9) * 0.16, 0.02, 2.5);
    vec3 prev = pos;
    vec3 a = -1.5 * h2 * pos / pow(r, 5.0);
    dir += a * dt;
    pos += dir * dt;

    if (prev.y * pos.y < 0.0) {
      vec3 hit = mix(prev, pos, prev.y / (prev.y - pos.y));
      vec4 d = disk(hit, dir);
      acc += (1.0 - accA) * d.rgb;
      accA += (1.0 - accA) * d.a;
      if (accA > 0.985) break;
    }
  }

  vec3 col = acc;
  if (!captured && accA < 0.985) col += (1.0 - accA) * background(normalize(dir));

  // The cursor lens has its own tiny shadow.
  col *= 1.0 - cursorShadow;
  col *= 1.0 - uFade;

  col = max(col, vec3(0.0));
  if (col.r != col.r || col.g != col.g || col.b != col.b) col = vec3(0.0); // never feed NaN to bloom
  gl_FragColor = vec4(min(col, vec3(40.0)), 1.0);
}
`;
