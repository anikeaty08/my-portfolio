import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { input, telemetry } from "./controls";
import { quality } from "./quality";

/** One-shot effect requests written by the car. */
export const effects = {
  splashAt: null as null | { t: number; x: number; z: number },
  honkAt: 0,
};

// ---------------------------------------------------------------- dust

const DUST = quality.mobile ? 120 : 260;

const dustVertex = /* glsl */ `
attribute float aAge;
attribute float aSize;
varying float vAge;
void main() {
  vAge = aAge;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (1.0 + aAge * 2.5) * (300.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;
const dustFragment = /* glsl */ `
uniform vec3 uColor;
varying float vAge;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float a = (1.0 - smoothstep(0.2, 0.5, d)) * (1.0 - vAge) * 0.55;
  gl_FragColor = vec4(uColor, a);
}
`;

function Dust() {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(DUST * 3), 3));
    g.setAttribute("aAge", new THREE.BufferAttribute(new Float32Array(DUST).fill(1), 1));
    g.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(DUST), 1));
    return g;
  }, []);
  const vel = useMemo(() => new Float32Array(DUST * 3), []);
  const life = useMemo(() => new Float32Array(DUST).fill(1), []);
  const cursor = useRef(0);
  const acc = useRef(0);

  useFrame((_, dt) => {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const age = geo.attributes.aAge as THREE.BufferAttribute;
    const size = geo.attributes.aSize as THREE.BufferAttribute;
    const speed = Math.abs(telemetry.speed);
    const lateral = Math.abs(telemetry.vx * Math.sin(telemetry.heading) + telemetry.vz * Math.cos(telemetry.heading));
    const rate = (speed > 3 ? speed * 3 : 0) + lateral * 14 + (input.throttle && speed < 4 ? 20 : 0);
    acc.current += rate * dt;
    while (acc.current > 1) {
      acc.current -= 1;
      const w = telemetry.wheels[2 + (cursor.current % 2)]; // rear wheels
      if (!w.contact) continue;
      const i = cursor.current++ % DUST;
      pos.setXYZ(i, w.pos.x + (Math.random() - 0.5) * 0.3, w.pos.y + 0.1, w.pos.z + (Math.random() - 0.5) * 0.3);
      vel[i * 3] = -telemetry.vx * 0.15 + (Math.random() - 0.5) * 0.8;
      vel[i * 3 + 1] = 0.6 + Math.random() * 0.8;
      vel[i * 3 + 2] = -telemetry.vz * 0.15 + (Math.random() - 0.5) * 0.8;
      life[i] = 0;
      size.setX(i, 0.35 + Math.random() * 0.35);
    }
    for (let i = 0; i < DUST; i++) {
      if (life[i] >= 1) continue;
      life[i] = Math.min(1, life[i] + dt / 1.1);
      pos.setXYZ(i, pos.getX(i) + vel[i * 3] * dt, pos.getY(i) + vel[i * 3 + 1] * dt, pos.getZ(i) + vel[i * 3 + 2] * dt);
      vel[i * 3 + 1] *= 0.96;
      age.setX(i, life[i]);
    }
    pos.needsUpdate = true;
    age.needsUpdate = true;
    size.needsUpdate = true;
  });

  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial vertexShader={dustVertex} fragmentShader={dustFragment} uniforms={{ uColor: { value: new THREE.Color("#e8dcc4") } }} transparent depthWrite={false} />
    </points>
  );
}

// ---------------------------------------------------------------- skid marks

const SKIDS = quality.mobile ? 300 : 700;

const skidVertex = /* glsl */ `
attribute float aBirth;
uniform float uTime;
varying float vAlpha;
void main() {
  vAlpha = 0.42 * (1.0 - clamp((uTime - aBirth) / 9.0, 0.0, 1.0));
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;
const skidFragment = /* glsl */ `
varying float vAlpha;
void main() { gl_FragColor = vec4(0.12, 0.12, 0.14, vAlpha); }
`;

function Skids() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const { geo, birth, uniforms } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(0.5, 0.26).rotateX(-Math.PI / 2);
    const birth = new THREE.InstancedBufferAttribute(new Float32Array(SKIDS).fill(-100), 1);
    geo.setAttribute("aBirth", birth);
    return { geo, birth, uniforms: { uTime: { value: 0 } } };
  }, []);
  const cursor = useRef(0);
  const lastAt = useRef([0, 0, 0, 0].map(() => new THREE.Vector3(1e9, 0, 0)));
  const m = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    const inst = mesh.current;
    if (!inst) return;
    uniforms.uTime.value = state.clock.elapsedTime;
    const speed = Math.abs(telemetry.speed);
    const lateral = Math.abs(telemetry.vx * Math.sin(telemetry.heading) + telemetry.vz * Math.cos(telemetry.heading));
    const skidding = (lateral > 2.2 && speed > 3) || (input.brake && speed > 5);
    if (!skidding) {
      lastAt.current.forEach((v) => v.set(1e9, 0, 0));
      return;
    }
    let dirty = false;
    telemetry.wheels.forEach((w, wi) => {
      if (!w.contact) return;
      const prev = lastAt.current[wi];
      if (prev.distanceToSquared(w.pos) < 0.09) return; // lay a mark every ~0.3 m
      const i = cursor.current++ % SKIDS;
      m.position.set(w.pos.x, w.pos.y + 0.03, w.pos.z);
      m.rotation.set(0, telemetry.heading, 0);
      m.updateMatrix();
      inst.setMatrixAt(i, m.matrix);
      birth.setX(i, state.clock.elapsedTime);
      prev.copy(w.pos);
      dirty = true;
    });
    if (dirty) {
      inst.instanceMatrix.needsUpdate = true;
      birth.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={mesh} args={[geo, undefined, SKIDS]} frustumCulled={false} renderOrder={1}>
      <shaderMaterial vertexShader={skidVertex} fragmentShader={skidFragment} uniforms={uniforms} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
    </instancedMesh>
  );
}

// ---------------------------------------------------------------- splash + honk ring

const SPLASH = 90;

function Splash() {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SPLASH * 3), 3));
    return g;
  }, []);
  const vel = useMemo(() => new Float32Array(SPLASH * 3), []);
  const mat = useRef<THREE.PointsMaterial>(null);
  const started = useRef(-1);
  const seen = useRef<number>(-1);

  useFrame((state, dt) => {
    const s = effects.splashAt;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    if (s && s.t !== seen.current) {
      seen.current = s.t;
      started.current = state.clock.elapsedTime;
      for (let i = 0; i < SPLASH; i++) {
        pos.setXYZ(i, s.x, -0.3, s.z);
        const a = Math.random() * Math.PI * 2;
        const r = 1 + Math.random() * 3;
        vel.set([Math.cos(a) * r, 4 + Math.random() * 5, Math.sin(a) * r], i * 3);
      }
    }
    const t = state.clock.elapsedTime - started.current;
    if (started.current < 0 || t > 1.6) {
      if (mat.current) mat.current.opacity = 0;
      return;
    }
    for (let i = 0; i < SPLASH; i++) {
      vel[i * 3 + 1] -= 14 * dt;
      pos.setXYZ(i, pos.getX(i) + vel[i * 3] * dt, pos.getY(i) + vel[i * 3 + 1] * dt, pos.getZ(i) + vel[i * 3 + 2] * dt);
    }
    pos.needsUpdate = true;
    if (mat.current) mat.current.opacity = 1 - t / 1.6;
  });

  return (
    <points geometry={geo} frustumCulled={false}>
      <pointsMaterial ref={mat} color="#e6f7ff" size={0.28} transparent opacity={0} depthWrite={false} />
    </points>
  );
}

function HonkRing() {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const r = ring.current;
    if (!r) return;
    const t = (performance.now() - effects.honkAt) / 600;
    r.visible = t < 1;
    if (!r.visible) return;
    r.position.set(telemetry.x, telemetry.y + 0.2, telemetry.z);
    r.scale.setScalar(1 + t * 5);
    (r.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.6;
  });
  return (
    <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.9, 1, 48]} />
      <meshBasicMaterial color="#ffffff" transparent depthWrite={false} />
    </mesh>
  );
}

export function Effects() {
  return (
    <>
      <Dust />
      <Skids />
      <Splash />
      <HonkRing />
    </>
  );
}
