import { useGLTF } from "@react-three/drei";
import { useFrame, useLoader } from "@react-three/fiber";
import { BallCollider, CuboidCollider, CylinderCollider, RigidBody, TrimeshCollider, type RapierRigidBody } from "@react-three/rapier";
import { useMemo } from "react";
import * as THREE from "three";
import { clack, emitters } from "../audio";
import { getState } from "../store";
import { progress } from "./achievements";
import { telemetry } from "./controls";
import { bakeRelativeTo, frameFrom, toFloat } from "./bake";
import { wind } from "./wind";

// ---------------------------------------------------------------- world.json (written by build_world.py)

type Vec3 = [number, number, number];
type StaticCollider =
  | { shape: "box"; pos: Vec3; half: Vec3; rotY?: number; quat?: [number, number, number, number] }
  | { shape: "cyl"; pos: Vec3; radius: number; halfHeight: number }
  | { shape: "trimesh"; node: string };
export type ZoneKind = "project" | "about" | "skills" | "contact" | "lighthouse" | "bowling" | "checkpoint" | "egg";
export type Zone = { id: string; kind: ZoneKind; slug?: string; pos: Vec3; radius: number };
type DynamicBase = { node: string; group: string; mass: number; /** Start transform (the Blender origin), three.js space. */ pos: Vec3; quat: [number, number, number, number] };
type DynamicDef =
  | (DynamicBase & { shape: "box"; half: Vec3 })
  | (DynamicBase & { shape: "ball"; radius: number })
  | (DynamicBase & { shape: "cyl"; radius: number; halfHeight: number });
export type WorldData = {
  ground: number;
  islandRadius: number;
  spawn: { pos: Vec3; rotY: number };
  colliders: StaticCollider[];
  dynamic: DynamicDef[];
  zones: Zone[];
  animated: string[];
  roads: { ringIn: number; ringOut: number; plaza: number; spokeHalf: number; spokes: number[] };
  clearings: [number, number, number][];
  /** Sand outline radius at 64 angles (theta = atan2(z, x)). */
  shore: number[];
  town: { center: Vec3; span: number; rotY: number };
};

export function useWorldData(): WorldData {
  const raw = useLoader(THREE.FileLoader, "/world/world.json") as string;
  return useMemo(() => JSON.parse(raw) as WorldData, [raw]);
}

/** Zones you park on to open a panel (the rest are silent triggers). */
export const INTERACTIVE: ZoneKind[] = ["project", "about", "skills", "contact", "lighthouse", "bowling"];

// ---------------------------------------------------------------- props registry (read by gameplay)

export type PropBody = { group: string; rb: RapierRigidBody; home: { p: THREE.Vector3; q: THREE.Quaternion } };
export const props: PropBody[] = [];

/** Puts a group of props back where Blender placed them. */
export function resetGroup(group: string) {
  for (const b of props) {
    if (b.group !== group) continue;
    b.rb.setTranslation(b.home.p, true);
    b.rb.setRotation(b.home.q, true);
    b.rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
    b.rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }
}

// ---------------------------------------------------------------- scene extraction

type Prop = { def: DynamicDef; node: THREE.Object3D; position: THREE.Vector3; quaternion: THREE.Quaternion; home: THREE.Vector3 };

/** Cached on the scene so React StrictMode's double render doesn't extract twice. */
function useExtracted(scene: THREE.Group, data: WorldData) {
  return useMemo(() => {
    if (scene.userData.extracted) return scene.userData.extracted as ReturnType<typeof extract>;
    const out = extract(scene, data);
    scene.userData.extracted = out;
    return out;
  }, [scene, data]);
}

/** Leaves and clouds sway with a shared wind clock. */
function addSway(mat: THREE.MeshStandardMaterial, amount: number) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind.uniform;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uWind;")
      .replace(
        "#include <begin_vertex>",
        /* glsl */ `#include <begin_vertex>
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float h = max(0.0, wp.y - 1.2);
        float s = sin(uWind * 0.9 + wp.x * 0.15 + wp.z * 0.11);
        transformed.x += s * h * ${amount.toFixed(3)};
        transformed.z += s * h * ${(amount * 0.6).toFixed(3)};`,
      );
  };
  mat.needsUpdate = true;
}

function extract(scene: THREE.Group, data: WorldData) {
  scene.updateMatrixWorld(true);
  const swayed = new Set<THREE.Material>();
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = !o.name.startsWith("cloud_");
    m.receiveShadow = true;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    mats.forEach((mat) => {
      const s = mat as THREE.MeshStandardMaterial;
      s.flatShading = !o.name.startsWith("dyn_pin") && !o.name.startsWith("dyn_ball") && !o.name.startsWith("egg");
      if (s.name.startsWith("leaf_") && !swayed.has(s)) {
        addSway(s, 0.012); // a gentle breeze; stronger reads as the crown twisting
        swayed.add(s);
      }
      s.needsUpdate = true;
    });
  });

  const out: Prop[] = [];
  for (const def of data.dynamic) {
    const source = scene.getObjectByName(def.node);
    if (!source) continue;
    const position = new THREE.Vector3(...def.pos);
    const quaternion = new THREE.Quaternion(...def.quat);
    const node = bakeRelativeTo(source, frameFrom(position, quaternion));
    source.removeFromParent();
    const home = position.clone();
    // The letters of the name start in the sky and fall into place when the game starts.
    if (def.group === "letter") position.y += 10 + Number(def.node.split("_").pop()) * 1.6;
    out.push({ def, node, position, quaternion, home });
  }

  const trimeshes = data.colliders
    .filter((c): c is Extract<StaticCollider, { shape: "trimesh" }> => c.shape === "trimesh")
    .map((c) => {
      const mesh = scene.getObjectByName(c.node) as THREE.Mesh | undefined;
      if (!mesh?.geometry) return null;
      const g = toFloat(mesh.geometry.clone()).applyMatrix4(mesh.matrixWorld); // float first: the GLB is quantized
      const vertices = new Float32Array(g.attributes.position.array);
      const index = g.index ? new Uint32Array(g.index.array) : new Uint32Array(vertices.length / 3).map((_, i) => i);
      return { vertices, index };
    })
    .filter(Boolean) as { vertices: Float32Array; index: Uint32Array }[];

  const animated = new Map<string, THREE.Object3D>();
  for (const name of data.animated) {
    const node = scene.getObjectByName(name);
    if (node) animated.set(name, node);
  }
  animated.forEach((node, name) => {
    if (!name.startsWith("pad_")) return;
    const m = node as THREE.Mesh;
    if (m.isMesh) m.material = (m.material as THREE.Material).clone();
  });
  const fire = animated.get("fire");
  if (fire) {
    const p = fire.getWorldPosition(new THREE.Vector3());
    emitters.fire = [p.x, p.z];
  }
  emitters.islandRadius = data.islandRadius;

  return { props: out, trimeshes, animated };
}

// ---------------------------------------------------------------- components

function StaticColliders({ data, trimeshes }: { data: WorldData; trimeshes: { vertices: Float32Array; index: Uint32Array }[] }) {
  return (
    <RigidBody type="fixed" colliders={false} friction={1}>
      {trimeshes.map((t, i) => (
        <TrimeshCollider key={`t${i}`} args={[t.vertices, t.index]} />
      ))}
      {data.colliders.map((c, i) => {
        if (c.shape === "box")
          return c.quat ? (
            <CuboidCollider key={i} args={c.half} position={c.pos} quaternion={c.quat} />
          ) : (
            <CuboidCollider key={i} args={c.half} position={c.pos} rotation={[0, c.rotY ?? 0, 0]} />
          );
        if (c.shape === "cyl") return <CylinderCollider key={i} args={[c.halfHeight, c.radius]} position={c.pos} />;
        return null;
      })}
    </RigidBody>
  );
}

const NOISY = new Set(["pin", "crate", "brick", "block", "ball"]);

function Props({ items }: { items: Prop[] }) {
  return (
    <>
      {items.map((p) => {
        const d = p.def;
        const collider =
          d.shape === "ball" ? (
            <BallCollider args={[d.radius]} mass={d.mass} friction={0.3} restitution={0.15} />
          ) : d.shape === "cyl" ? (
            <CylinderCollider args={[d.halfHeight, d.radius]} mass={d.mass} friction={0.5} restitution={0.3} />
          ) : (
            <CuboidCollider args={d.half} mass={d.mass} friction={0.8} restitution={0.2} />
          );
        return (
          <RigidBody
            key={p.node.name}
            ref={(rb) => {
              if (!rb) return;
              const i = props.findIndex((b) => b.rb === rb || (b.group === d.group && b.home.p.equals(p.home)));
              const entry = { group: d.group, rb, home: { p: p.home, q: p.quaternion.clone() } };
              if (i >= 0) props[i] = entry;
              else props.push(entry);
            }}
            position={p.position}
            quaternion={p.quaternion}
            colliders={false}
            linearDamping={d.shape === "ball" ? 0.15 : 0.3}
            angularDamping={d.shape === "ball" ? 0.2 : 0.4}
            canSleep
            onContactForce={
              NOISY.has(d.group)
                ? (e) => {
                    if (e.totalForceMagnitude > 25) clack(Math.min(8, e.totalForceMagnitude / 20));
                  }
                : undefined
            }
          >
            {collider}
            <primitive object={p.node} />
          </RigidBody>
        );
      })}
    </>
  );
}

const seg = { a: new THREE.Vector3(), b: new THREE.Vector3(), p: new THREE.Vector3(), closest: new THREE.Vector3(), line: new THREE.Line3() };

/** Buildings get their own transparent-capable materials so each can fade independently. */
function prepareBuildings(animated: Map<string, THREE.Object3D>) {
  const out: { node: THREE.Object3D; mats: THREE.MeshStandardMaterial[]; radius: number; center: THREE.Vector3; fade: number }[] = [];
  animated.forEach((node, name) => {
    if (!name.startsWith("bldg_")) return;
    const mats: THREE.MeshStandardMaterial[] = [];
    node.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const list = (Array.isArray(m.material) ? m.material : [m.material]).map((mat) => {
        const c = (mat as THREE.MeshStandardMaterial).clone();
        c.transparent = true;
        mats.push(c);
        return c;
      });
      m.material = Array.isArray(m.material) ? list : list[0];
    });
    const box = new THREE.Box3().setFromObject(node);
    const size = box.getSize(new THREE.Vector3());
    out.push({ node, mats, radius: Math.max(size.x, size.z) * 0.6 + 1, center: box.getCenter(new THREE.Vector3()), fade: 1 });
  });
  return out;
}

function Animator({ animated }: { animated: Map<string, THREE.Object3D> }) {
  const buildings = useMemo(() => prepareBuildings(animated), [animated]);
  const windowMats = useMemo(() => {
    const set = new Set<THREE.MeshStandardMaterial>();
    buildings.forEach((b) => b.mats.forEach((m) => m.name === "windows" && set.add(m)));
    return [...set];
  }, [buildings]);
  const clouds = useMemo(() => [...animated].filter(([n]) => n.startsWith("cloud_")).map(([, o]) => ({ o, r: Math.hypot(o.position.x, o.position.z), a: Math.atan2(o.position.z, o.position.x) })), [animated]);
  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    wind.uniform.value = t;
    const { zone, night } = getState();
    // Fade any building standing between the camera and the car.
    seg.a.copy(state.camera.position);
    seg.b.set(telemetry.x, telemetry.y + 0.5, telemetry.z);
    seg.line.set(seg.a, seg.b);
    for (const b of buildings) {
      seg.line.closestPointToPoint(b.center, true, seg.closest);
      const blocking = seg.closest.distanceTo(b.center) < b.radius && seg.closest.distanceTo(seg.b) > 1.5;
      const target = blocking ? 0.22 : 1;
      if (Math.abs(b.fade - target) < 0.01) continue;
      b.fade += (target - b.fade) * Math.min(1, delta * 6);
      for (const m of b.mats) {
        m.opacity = b.fade;
        m.depthWrite = b.fade > 0.95;
      }
    }
    for (const m of windowMats) m.emissiveIntensity = night ? 2.4 : 0.35;
    // Traffic light: green 3 s, amber 1 s, red 3 s.
    const phase = t % 7;
    const lamp = (name: string, on: boolean) => {
      const n = animated.get(name) as THREE.Mesh | undefined;
      if (n) (n.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 6 : 0.15;
    };
    lamp("tl_green", phase < 3);
    lamp("tl_amber", phase >= 3 && phase < 4);
    lamp("tl_red", phase >= 4);
    for (const c of clouds) {
      c.a += delta * 0.012;
      c.o.position.x = Math.cos(c.a) * c.r;
      c.o.position.z = Math.sin(c.a) * c.r;
    }
    animated.forEach((node, name) => {
      if (name.startsWith("pad_")) {
        const mat = (node as THREE.Mesh).material as THREE.MeshStandardMaterial;
        const id = name.slice(4);
        const zoneId = ["skills", "about", "contact", "lighthouse", "bowling"].includes(id) ? id : `project:${id}`;
        const on = zone === zoneId;
        mat.emissiveIntensity = on ? 3.2 : 0.9 + Math.sin(t * 2.4 + node.position.x) * 0.45;
        const s = on ? 1.08 : 1;
        node.scale.set(s, 1, s);
      } else if (name.startsWith("project_")) {
        const baseY = (node.userData.baseY ??= node.position.y) as number;
        node.rotation.y = t * 0.6 + node.position.z;
        node.position.y = baseY + Math.sin(t * 1.5 + node.position.z) * 0.15;
      } else if (name.startsWith("egg_")) {
        const collected = progress.eggs.includes(Number(name.split("_")[1]));
        node.visible = !collected;
        const baseY = (node.userData.baseY ??= node.position.y) as number;
        node.rotation.y = t * 2;
        node.position.y = baseY + Math.sin(t * 2.5) * 0.12;
      } else if (name === "fire") {
        const f = 1 + Math.sin(t * 17) * 0.08 + Math.sin(t * 7.3) * 0.1;
        node.scale.set(f, 1 + Math.sin(t * 11) * 0.15, f);
      } else if (name === "beacon") {
        node.visible = Math.sin(t * 3) > -0.2;
      } else if (name === "lighthouse_lamp") {
        const m = (node as THREE.Mesh).material as THREE.MeshStandardMaterial;
        m.emissiveIntensity = night ? 8 : 2;
      }
    });
  });
  return null;
}

export function World({ data }: { data: WorldData }) {
  const { scene } = useGLTF("/world/world.glb");
  const { props: items, trimeshes, animated } = useExtracted(scene, data);
  return (
    <>
      <primitive object={scene} />
      <StaticColliders data={data} trimeshes={trimeshes} />
      <Props items={items} />
      <Animator animated={animated} />
    </>
  );
}

useGLTF.preload("/world/world.glb");
