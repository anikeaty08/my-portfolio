import { Float, Sparkles, Stars, MeshPortalMaterial, useGLTF } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { projects, type Project } from "../content";
import { scroll } from "../scroll";
import { getState, setState, useStore } from "../store";
import { quality } from "./quality";

const SPACING = 14;
const N = projects.length;
const LAST_Z = -(N - 1) * SPACING;
export const WHITE_HOLE = new THREE.Vector3(0, 2, LAST_Z - 38);

/** Where portal i sits. Wide screens alternate left/right; narrow screens stack it above the text. */
function portalPose(i: number, aspect: number, out = new THREE.Vector3()) {
  const wide = aspect > 1.1;
  const side = i % 2 === 0 ? 1 : -1;
  return out.set(wide ? side * 2.5 : 0, wide ? Math.sin(i * 1.7) * 0.35 : 1.25, -i * SPACING);
}

// ---------------------------------------------------------------- camera

const camTarget = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
const look = new THREE.Vector3(0, 0, -10);
const a = new THREE.Vector3();
const b = new THREE.Vector3();

function CameraRig() {
  const { camera, size } = useThree();
  useFrame((_, delta) => {
    if (scroll.dive < 0.9) return;
    const aspect = size.width / size.height;
    const arrival = THREE.MathUtils.smoothstep(scroll.dive, 0.9, 1.0);
    const { active } = getState();

    const f = scroll.work * (N - 1);
    const k = Math.min(Math.floor(f), N - 2);
    const e = THREE.MathUtils.smoothstep(f - k, 0.12, 0.88);
    portalPose(k, aspect, a);
    portalPose(k + 1, aspect, b);
    const p = a.lerp(b, e);
    const current = Math.round(k + e);
    if (current !== getState().current) setState({ current });

    const dist = aspect > 1.1 ? 7.5 : 9.5;
    const o = THREE.MathUtils.smoothstep(scroll.outro, 0, 1);
    camTarget.set(p.x * 0.15 + scroll.mx * 0.45, p.y * 0.5 + 0.15 + scroll.my * 0.3, p.z + dist);
    camTarget.z += (1 - arrival) * 28 - o * 20;
    camTarget.y += o * 1.2;
    lookTarget.set(p.x * 0.55, p.y * (aspect > 1.1 ? 1 : 0.2), p.z).lerp(WHITE_HOLE, o * 0.85);

    if (active !== null) {
      portalPose(active, aspect, camTarget).z += 1.35;
      portalPose(active, aspect, lookTarget).z -= 4;
    }

    const t = 1 - Math.exp(-delta * (active !== null ? 2.2 : 3.2));
    camera.position.lerp(camTarget, t);
    look.lerp(lookTarget, t);
    camera.lookAt(look);
  });
  return null;
}

// ---------------------------------------------------------------- portal world

const skyVertex = /* glsl */ `
varying vec3 vPos;
void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const skyFragment = /* glsl */ `
uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uGlow;
varying vec3 vPos;
void main() {
  vec3 d = normalize(vPos);
  vec3 col = mix(uBottom, uTop, smoothstep(-0.6, 0.8, d.y));
  col += uGlow * pow(max(0.0, 1.0 - length(d.xy - vec2(0.0, 0.05)) * 1.3), 3.0) * 0.6;
  gl_FragColor = vec4(col, 1.0);
}
`;

function PortalWorld({ project }: { project: Project }) {
  const { scene } = useGLTF(`/models/${project.model}.glb`);
  const model = useMemo(() => scene.clone(true), [scene]);
  const spin = useRef<THREE.Group>(null);
  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color(project.sky[0]) },
      uBottom: { value: new THREE.Color(project.sky[1]) },
      uGlow: { value: new THREE.Color(project.color) },
    }),
    [project],
  );

  useFrame((state, delta) => {
    if (!spin.current) return;
    spin.current.rotation.y += delta * 0.35;
    spin.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.4) * 0.12;
  });

  return (
    <>
      <mesh position={[0, 0, -3]}>
        <sphereGeometry args={[9, 32, 16]} />
        <shaderMaterial side={THREE.BackSide} vertexShader={skyVertex} fragmentShader={skyFragment} uniforms={uniforms} depthWrite={false} />
      </mesh>
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 3, 4]} intensity={2.4} />
      <pointLight position={[0, -1, -1]} color={project.color} intensity={25} distance={8} />
      <pointLight position={[-2, 2, -5]} color="#ffffff" intensity={12} distance={10} />
      <Float speed={1.6} rotationIntensity={0.25} floatIntensity={0.6}>
        <group ref={spin} position={[0, 0, -3.2]} scale={0.95}>
          <primitive object={model} />
        </group>
      </Float>
      <mesh position={[0, -1.55, -3.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1.35, 64]} />
        <meshBasicMaterial color={new THREE.Color(project.color).multiplyScalar(2)} transparent opacity={0.35} toneMapped={false} />
      </mesh>
      <Sparkles count={70} scale={[7, 5, 5]} position={[0, 0, -3.5]} size={2.5} speed={0.35} color={project.color} />
    </>
  );
}

// ---------------------------------------------------------------- portal

function makeSwirl(count: number, color: string) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const c = new THREE.Color(color);
  const white = new THREE.Color("#fff");
  for (let i = 0; i < count; i++) {
    const r = 1.6 + Math.pow(Math.random(), 2.2) * 1.1;
    const t = Math.random() * Math.PI * 2;
    pos.set([Math.cos(t) * r, Math.sin(t) * r, (Math.random() - 0.5) * 0.15], i * 3);
    const mix = c.clone().lerp(white, Math.max(0, 1 - (r - 1.6) * 2.5) * 0.7).multiplyScalar(1.6);
    col.set([mix.r, mix.g, mix.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

function Portal({ project, index }: { project: Project; index: number }) {
  const { size } = useThree();
  const group = useRef<THREE.Group>(null);
  const swirl = useRef<THREE.Points>(null);
  const hovered = useStore((s) => s.hovered === index);
  const swirlGeo = useMemo(() => makeSwirl(quality.mobile ? 500 : 1100, project.color), [project.color]);
  const ringColor = useMemo(() => new THREE.Color(project.color).multiplyScalar(5), [project.color]);
  const pose = useMemo(() => portalPose(index, size.width / size.height), [index, size]);
  const tilt = pose.x === 0 ? 0 : -Math.sign(pose.x) * 0.32;

  useFrame((state, delta) => {
    if (swirl.current) swirl.current.rotation.z -= delta * (hovered ? 1.1 : 0.35);
    if (group.current) {
      const s = hovered ? 1.06 : 1;
      group.current.scale.lerp(new THREE.Vector3(s, s, s), 1 - Math.exp(-delta * 8));
      group.current.position.y = pose.y + Math.sin(state.clock.elapsedTime * 0.8 + index) * 0.08;
    }
  });

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setState({ hovered: index });
    document.body.dataset.hover = "portal";
  };
  const out = () => {
    if (getState().hovered === index) setState({ hovered: null });
    delete document.body.dataset.hover;
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setState({ active: index, hovered: null });
    delete document.body.dataset.hover;
  };

  return (
    <group ref={group} position={[pose.x, pose.y, pose.z]} rotation={[0, tilt, 0]}>
      <mesh onPointerOver={over} onPointerOut={out} onClick={click}>
        <circleGeometry args={[1.5, 96]} />
        <MeshPortalMaterial blur={0} resolution={quality.mobile ? 256 : 512}>
          <PortalWorld project={project} />
        </MeshPortalMaterial>
      </mesh>
      <mesh>
        <torusGeometry args={[1.5, 0.03, 16, 128]} />
        <meshBasicMaterial color={ringColor} toneMapped={false} />
      </mesh>
      <mesh>
        <torusGeometry args={[1.58, 0.006, 8, 128]} />
        <meshBasicMaterial color={ringColor} toneMapped={false} transparent opacity={0.5} />
      </mesh>
      <points ref={swirl} geometry={swirlGeo}>
        <pointsMaterial size={0.035} vertexColors transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </points>
    </group>
  );
}

// ---------------------------------------------------------------- asteroids

function Asteroids() {
  const gltfs = useGLTF(["/models/asteroid1.glb", "/models/asteroid2.glb", "/models/asteroid3.glb"]);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const count = quality.mobile ? 14 : 26;

  const sets = useMemo(
    () =>
      gltfs.map((g, gi) => {
        let geometry: THREE.BufferGeometry | undefined;
        let material: THREE.Material | undefined;
        g.scene.traverse((o) => {
          if (!geometry && (o as THREE.Mesh).isMesh) {
            geometry = (o as THREE.Mesh).geometry;
            material = (o as THREE.Mesh).material as THREE.Material;
          }
        });
        const rnd = mulberry32(gi * 99 + 5);
        const items = Array.from({ length: count }, () => {
          const side = rnd() > 0.5 ? 1 : -1;
          return {
            pos: new THREE.Vector3(side * (5.5 + rnd() * 12), (rnd() - 0.5) * 12, 12 - rnd() * (-LAST_Z + 50)),
            rot: new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6),
            spin: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.4),
            scale: 0.25 + Math.pow(rnd(), 2) * 1.4,
          };
        });
        return { geometry: geometry!, material: material!, items };
      }),
    [gltfs, count],
  );

  const m = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, delta) => {
    sets.forEach((set, si) => {
      const inst = refs.current[si];
      if (!inst) return;
      set.items.forEach((it, i) => {
        it.rot.x += it.spin.x * delta;
        it.rot.y += it.spin.y * delta;
        m.position.copy(it.pos);
        m.rotation.copy(it.rot);
        m.scale.setScalar(it.scale);
        m.updateMatrix();
        inst.setMatrixAt(i, m.matrix);
      });
      inst.instanceMatrix.needsUpdate = true;
    });
  });

  return (
    <>
      {sets.map((set, i) => (
        <instancedMesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          args={[set.geometry, set.material, set.items.length]}
          frustumCulled={false}
        />
      ))}
    </>
  );
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- white hole (the exit)

const glowFragment = /* glsl */ `
uniform vec3 uColor;
varying vec3 vNormal; varying vec3 vView;
void main() {
  float f = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.2);
  gl_FragColor = vec4(uColor * f, f);
}
`;
const glowVertex = /* glsl */ `
varying vec3 vNormal; varying vec3 vView;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalMatrix * normal;
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

function WhiteHole() {
  const rings = useRef<THREE.Group>(null);
  const glowUniforms = useMemo(() => ({ uColor: { value: new THREE.Color("#ffd7a8").multiplyScalar(3) } }), []);
  useFrame((_, delta) => {
    if (!rings.current) return;
    rings.current.children.forEach((c, i) => {
      c.rotation.z += delta * (0.15 + i * 0.07) * (i % 2 ? -1 : 1);
    });
  });
  return (
    <group position={WHITE_HOLE}>
      <mesh>
        <sphereGeometry args={[2.2, 48, 32]} />
        <meshBasicMaterial color={new THREE.Color("#fff4e0").multiplyScalar(6)} toneMapped={false} />
      </mesh>
      <mesh scale={2.6}>
        <sphereGeometry args={[2.2, 48, 32]} />
        <shaderMaterial vertexShader={glowVertex} fragmentShader={glowFragment} uniforms={glowUniforms} transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.BackSide} />
      </mesh>
      <group ref={rings} rotation={[1.25, 0.2, 0]}>
        {[3.6, 4.6, 6.2, 8.4].map((r, i) => (
          <mesh key={r}>
            <torusGeometry args={[r, 0.02 + i * 0.006, 8, 160]} />
            <meshBasicMaterial color={new THREE.Color(i % 2 ? "#ff9d4d" : "#ffe2b8").multiplyScalar(3 - i * 0.5)} toneMapped={false} transparent opacity={0.8 - i * 0.15} />
          </mesh>
        ))}
      </group>
      <pointLight color="#ffd7a8" intensity={400} distance={90} decay={1.4} />
    </group>
  );
}

// ---------------------------------------------------------------- root

export function Universe() {
  const root = useRef<THREE.Group>(null);
  useFrame(() => {
    if (root.current) root.current.visible = scroll.dive > 0.9;
  });

  return (
    <>
      <CameraRig />
      <group ref={root} visible={false}>
        <ambientLight intensity={0.25} />
        <directionalLight position={[5, 8, 6]} intensity={1.2} color="#cfd8ff" />
        <Stars radius={140} depth={80} count={quality.mobile ? 3000 : 7000} factor={5} saturation={0.4} fade speed={0.6} />
        {projects.map((p, i) => (
          <Portal key={p.slug} project={p} index={i} />
        ))}
        <Asteroids />
        <WhiteHole />
      </group>
    </>
  );
}

projects.forEach((p) => useGLTF.preload(`/models/${p.model}.glb`));
