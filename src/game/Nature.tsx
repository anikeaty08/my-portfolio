import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useStore } from "../store";
import { quality } from "./quality";
import { wind } from "./wind";
import type { WorldData } from "./World";

// ---------------------------------------------------------------- grass

const grassVertex = /* glsl */ `
uniform float uWind;
attribute vec3 aOffset;
attribute vec2 aShape; // x: height, y: yaw
varying float vTip;
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vTip = position.y;
  float c = cos(aShape.y), s = sin(aShape.y);
  vec3 p = vec3(position.x * c, position.y * aShape.x, position.x * s);
  float gust = sin(uWind * 1.9 + aOffset.x * 0.18 + aOffset.z * 0.13) * 0.5 + sin(uWind * 3.7 + aOffset.x * 0.9) * 0.2;
  p.x += gust * vTip * vTip * 0.35;
  p.z += gust * vTip * vTip * 0.18;
  vec4 world = vec4(p + aOffset, 1.0);
  vWorld = world.xyz;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;
const grassFragment = /* glsl */ `
uniform vec3 uBase;
uniform vec3 uTip;
uniform float uLight;
varying float vTip;
varying vec3 vWorld;
#include <fog_pars_fragment>
void main() {
  float patchy = 0.85 + 0.15 * sin(vWorld.x * 0.21) * sin(vWorld.z * 0.17);
  vec3 col = mix(uBase, uTip, vTip) * patchy * uLight;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

function onRoad(x: number, z: number, data: WorldData) {
  const r = Math.hypot(x, z);
  const R = data.roads;
  if (r < R.plaza + 0.6) return true;
  if (r > R.ringIn - 0.6 && r < R.ringOut + 0.6) return true;
  for (const deg of R.spokes) {
    const a = (deg * Math.PI) / 180;
    // Blender angle → three: (cos a, -sin a) in x/z
    const along = x * Math.cos(a) - z * Math.sin(a);
    const across = Math.abs(x * Math.sin(a) + z * Math.cos(a));
    if (along > 0 && across < R.spokeHalf + 0.6) return true;
  }
  return false;
}

function Grass({ data }: { data: WorldData }) {
  const night = useStore((s) => s.night);
  const count = quality.lite ? 9000 : quality.mobile ? 16000 : 60000; // one draw call however many
  const light = useRef(1);

  const { geo, uniforms } = useMemo(() => {
    // One triangle per blade, instanced; height and yaw vary per instance.
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-0.07, 0, 0, 0.07, 0, 0, 0, 1, 0]), 3));
    const offsets = new Float32Array(count * 3);
    const shapes = new Float32Array(count * 2);
    const circles = [
      ...data.clearings,
      ...data.colliders.flatMap((c) => (c.shape === "cyl" ? [[c.pos[0], c.pos[2], c.radius + 0.2]] : [])),
      ...data.zones.map((z) => [z.pos[0], z.pos[2], z.kind === "checkpoint" ? 0 : z.radius]),
    ] as [number, number, number][];
    const maxR = data.islandRadius - 2.5;
    let n = 0;
    let tries = 0;
    while (n < count && tries < count * 8) {
      tries++;
      const r = Math.sqrt(Math.random()) * maxR;
      const a = Math.random() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (onRoad(x, z, data)) continue;
      if (circles.some(([cx, cz, cr]) => (x - cx) ** 2 + (z - cz) ** 2 < cr * cr)) continue;
      offsets.set([x, data.ground, z], n * 3);
      shapes.set([0.35 + Math.random() * 0.45, Math.random() * Math.PI], n * 2);
      n++;
    }
    geo.setAttribute("aOffset", new THREE.InstancedBufferAttribute(offsets, 3));
    geo.setAttribute("aShape", new THREE.InstancedBufferAttribute(shapes, 2));
    geo.instanceCount = n;
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uWind: wind.uniform, uBase: { value: new THREE.Color("#4f8f35") }, uTip: { value: new THREE.Color("#b5e27a") }, uLight: { value: 1 } }]);
    uniforms.uWind = wind.uniform; // keep the shared reference after merge's clone
    return { geo, uniforms };
  }, [data, count]);

  useFrame((_, dt) => {
    light.current += ((night ? 0.38 : 1) - light.current) * Math.min(1, dt * 2);
    uniforms.uLight.value = light.current;
  });

  return (
    <mesh geometry={geo} frustumCulled={false}>
      <shaderMaterial vertexShader={grassVertex} fragmentShader={grassFragment} uniforms={uniforms} side={THREE.DoubleSide} fog />
    </mesh>
  );
}

// ---------------------------------------------------------------- water

const waterVertex = /* glsl */ `
uniform float uTime;
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vec3 p = position;
  vec4 world = modelMatrix * vec4(p, 1.0);
  world.y += sin(world.x * 0.25 + uTime * 1.3) * 0.08 + sin(world.z * 0.31 - uTime * 1.1) * 0.06;
  vWorld = world.xyz;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;
const waterFragment = /* glsl */ `
uniform float uTime;
uniform float uShoreR[64];
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uFoam;
varying vec3 vWorld;
#include <fog_pars_fragment>

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

void main() {
  float r = length(vWorld.xz);
  float a = atan(vWorld.z, vWorld.x);
  // Exact sand outline exported from Blender, 64 samples around the island.
  float t = fract(a / 6.28318530718 + 1.0) * 64.0;
  int i0 = int(floor(t)) % 64;
  float edge = mix(uShoreR[i0], uShoreR[(i0 + 1) % 64], fract(t));
  float d = r - edge;
  vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 26.0, d));
  // Foam: a band hugging the beach plus ripples that roll in toward it.
  float band = 1.0 - smoothstep(0.0, 1.6, abs(d - 0.4));
  float ripple = smoothstep(0.75, 1.0, sin(d * 1.6 + uTime * 2.2)) * (1.0 - smoothstep(0.0, 9.0, d));
  float sparkle = smoothstep(0.93, 1.0, noise(vWorld.xz * 0.6 + uTime * 0.4)) * 0.35;
  col = mix(col, uFoam, clamp(band * 0.9 + ripple * 0.55 + sparkle, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

function Water({ data }: { data: WorldData }) {
  const night = useStore((s) => s.night);
  const mix = useRef(0);
  const uniforms = useMemo(
    () =>
      THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uShoreR: { value: data.shore?.length === 64 ? data.shore : new Array(64).fill(data.islandRadius + 4) },
          uDeep: { value: new THREE.Color("#1f7fb8") },
          uShallow: { value: new THREE.Color("#5fd0e6") },
          uFoam: { value: new THREE.Color("#f4fbff") },
        },
      ]),
    [data],
  );
  const day = useMemo(() => ({ deep: new THREE.Color("#1f7fb8"), shallow: new THREE.Color("#5fd0e6"), foam: new THREE.Color("#f4fbff") }), []);
  const dark = useMemo(() => ({ deep: new THREE.Color("#0b2442"), shallow: new THREE.Color("#1d4f73"), foam: new THREE.Color("#8fb3d9") }), []);

  useFrame((state, dt) => {
    uniforms.uTime.value = state.clock.elapsedTime;
    mix.current += ((night ? 1 : 0) - mix.current) * Math.min(1, dt * 2);
    uniforms.uDeep.value.copy(day.deep).lerp(dark.deep, mix.current);
    uniforms.uShallow.value.copy(day.shallow).lerp(dark.shallow, mix.current);
    uniforms.uFoam.value.copy(day.foam).lerp(dark.foam, mix.current);
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.35, 0]}>
      <planeGeometry args={[420, 420, 140, 140]} />
      <shaderMaterial vertexShader={waterVertex} fragmentShader={waterFragment} uniforms={uniforms} fog />
    </mesh>
  );
}

export function Nature({ data }: { data: WorldData }) {
  return (
    <>
      <Water data={data} />
      <Grass data={data} />
    </>
  );
}
