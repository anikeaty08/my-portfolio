import { useGLTF } from "@react-three/drei";
import { useFrame, useLoader } from "@react-three/fiber";
import { CuboidCollider, CylinderCollider, RigidBody, TrimeshCollider } from "@react-three/rapier";
import { useMemo } from "react";
import * as THREE from "three";
import { getState } from "../store";

// ---------------------------------------------------------------- world.json (written by build_world.py)

type Vec3 = [number, number, number];
type StaticCollider =
  | { shape: "box"; pos: Vec3; half: Vec3; rotY: number }
  | { shape: "cyl"; pos: Vec3; radius: number; halfHeight: number }
  | { shape: "trimesh"; node: string };
export type Zone = { id: string; kind: "project" | "about" | "skills" | "contact" | "lighthouse"; slug?: string; pos: Vec3; radius: number };
export type WorldData = {
  ground: number;
  islandRadius: number;
  spawn: { pos: Vec3; rotY: number };
  colliders: StaticCollider[];
  dynamic: { node: string; shape: "box"; mass: number; half: Vec3 }[];
  zones: Zone[];
  animated: string[];
};

export function useWorldData(): WorldData {
  const raw = useLoader(THREE.FileLoader, "/world/world.json") as string;
  return useMemo(() => JSON.parse(raw) as WorldData, [raw]);
}

// ---------------------------------------------------------------- scene extraction

type Prop = { node: THREE.Object3D; position: THREE.Vector3; quaternion: THREE.Quaternion; half: Vec3; mass: number };

/**
 * Splits the GLB into: static scenery, dynamic props (moved into rigid bodies) and animated nodes.
 * Cached on the scene so React StrictMode's double render doesn't extract twice.
 */
function useExtracted(scene: THREE.Group, data: WorldData) {
  return useMemo(() => {
    if (scene.userData.extracted) return scene.userData.extracted as ReturnType<typeof extract>;
    const out = extract(scene, data);
    scene.userData.extracted = out;
    return out;
  }, [scene, data]);
}

function extract(scene: THREE.Group, data: WorldData) {
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    mats.forEach((mat) => {
      const s = mat as THREE.MeshStandardMaterial;
      s.flatShading = true;
      s.needsUpdate = true;
    });
  });

  const props: Prop[] = [];
  for (const d of data.dynamic) {
    const node = scene.getObjectByName(d.node);
    if (!node) continue;
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    node.getWorldPosition(position);
    node.getWorldQuaternion(quaternion);
    node.removeFromParent();
    node.position.set(0, 0, 0);
    node.quaternion.identity();
    props.push({ node, position, quaternion, half: d.half, mass: d.mass });
  }

  const trimeshes = data.colliders
    .filter((c): c is Extract<StaticCollider, { shape: "trimesh" }> => c.shape === "trimesh")
    .map((c) => {
      const mesh = scene.getObjectByName(c.node) as THREE.Mesh | undefined;
      if (!mesh?.geometry) return null;
      const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
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
  // Pads get their own material so they can pulse independently of other white-emissive parts.
  animated.forEach((node, name) => {
    if (!name.startsWith("pad_")) return;
    const m = node as THREE.Mesh;
    if (m.isMesh) m.material = (m.material as THREE.Material).clone();
  });

  return { props, trimeshes, animated };
}

// ---------------------------------------------------------------- components

function StaticColliders({ data, trimeshes }: { data: WorldData; trimeshes: { vertices: Float32Array; index: Uint32Array }[] }) {
  return (
    <RigidBody type="fixed" colliders={false} friction={1}>
      {trimeshes.map((t, i) => (
        <TrimeshCollider key={`t${i}`} args={[t.vertices, t.index]} />
      ))}
      {data.colliders.map((c, i) => {
        if (c.shape === "box") return <CuboidCollider key={i} args={c.half} position={c.pos} rotation={[0, c.rotY, 0]} />;
        if (c.shape === "cyl") return <CylinderCollider key={i} args={[c.halfHeight, c.radius]} position={c.pos} />;
        return null;
      })}
    </RigidBody>
  );
}

function Props({ props }: { props: Prop[] }) {
  return (
    <>
      {props.map((p) => (
        <RigidBody
          key={p.node.name}
          position={p.position}
          quaternion={p.quaternion}
          colliders={false}
          linearDamping={0.3}
          angularDamping={0.4}
          canSleep
        >
          <CuboidCollider args={p.half} mass={p.mass} friction={0.8} restitution={0.2} />
          <primitive object={p.node} />
        </RigidBody>
      ))}
    </>
  );
}

function Animator({ animated }: { animated: Map<string, THREE.Object3D> }) {
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const { zone, night } = getState();
    animated.forEach((node, name) => {
      if (name.startsWith("pad_")) {
        const mat = (node as THREE.Mesh).material as THREE.MeshStandardMaterial;
        const zoneId = name === "pad_skills" || name === "pad_about" || name === "pad_contact" || name === "pad_lighthouse" ? name.slice(4) : `project:${name.slice(4)}`;
        const on = zone === zoneId;
        mat.emissiveIntensity = on ? 3.2 : 0.9 + Math.sin(t * 2.4 + node.position.x) * 0.45;
        const s = on ? 1.08 : 1;
        node.scale.set(s, 1, s);
      } else if (name.startsWith("project_")) {
        const baseY = (node.userData.baseY ??= node.position.y) as number;
        node.rotation.y = t * 0.6 + node.position.z;
        node.position.y = baseY + Math.sin(t * 1.5 + node.position.z) * 0.15;
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
  const { props, trimeshes, animated } = useExtracted(scene, data);
  return (
    <>
      <primitive object={scene} />
      <StaticColliders data={data} trimeshes={trimeshes} />
      <Props props={props} />
      <Animator animated={animated} />
    </>
  );
}

useGLTF.preload("/world/world.glb");
