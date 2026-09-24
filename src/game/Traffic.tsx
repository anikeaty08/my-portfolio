import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { bakeRelativeTo } from "./bake";
import { CarLights, takeLampMaterials } from "./CarLights";
import { telemetry } from "./controls";
import type { WorldData } from "./World";

const COLORS = ["#3b82f6", "#10b981", "#e5e7eb"];
const CRUISE = 7.5; // m/s
const ACCEL = 2.5; // m/s²
const BRAKE = 9; // m/s²
const STOP_GAP = 5.5; // m, bumper to bumper-ish
const SLOW_GAP = 16; // m, start easing off

/**
 * NPC cars on the inner lane of the ring road, driving clockwise (against the player's lap direction).
 * They look ahead along the lane and brake for the player or the car in front, then pull away again.
 * Kinematic bodies: physics can't knock them off their lane, but they still push props around.
 */
export function Traffic({ data }: { data: WorldData }) {
  const { scene } = useGLTF("/world/car.glb");
  const bodies = useRef<(RapierRigidBody | null)[]>([]);
  const lane = data.roads.ringIn + (data.roads.ringOut - data.roads.ringIn) * 0.27;

  const cars = useMemo(() => {
    const wheel = bakeRelativeTo(scene.getObjectByName("wheel")!, new THREE.Matrix4());
    const center = new THREE.Box3().setFromObject(wheel).getCenter(new THREE.Vector3());
    wheel.children.forEach((m) => (m as THREE.Mesh).geometry.translate(-center.x, -center.y, -center.z));
    return COLORS.map((color, i) => {
      const group = new THREE.Group();
      const body = bakeRelativeTo(scene.getObjectByName("body")!, new THREE.Matrix4());
      const recolor = (mat: THREE.Material) => {
        if (mat.name !== "orange") return mat;
        const c = (mat as THREE.MeshStandardMaterial).clone();
        c.color.set(color);
        return c;
      };
      body.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = true;
        m.material = Array.isArray(m.material) ? m.material.map(recolor) : recolor(m.material);
      });
      const lamps = takeLampMaterials(body);
      group.add(body);
      for (const [x, z] of [[0.8, -0.64], [0.8, 0.64], [-0.8, -0.64], [-0.8, 0.64]]) {
        const w = wheel.clone();
        w.position.set(x, -0.3, z);
        group.add(w);
      }
      // Evenly spaced round the ring; angle decreases as they drive (clockwise from above).
      return { group, lamps, angle: (i / COLORS.length) * Math.PI * 2, speed: CRUISE, braking: false };
    });
  }, [scene]);

  const q = useMemo(() => new THREE.Quaternion(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const playerAngle = Math.atan2(telemetry.z, telemetry.x);
    const playerOnLane = Math.abs(Math.hypot(telemetry.x, telemetry.z) - lane) < 2.4;

    cars.forEach((car, i) => {
      // Distance along the lane to the nearest thing ahead (the player, or another NPC).
      const aheadGap = (angle: number) => {
        let d = car.angle - angle; // ahead = smaller angle
        d = ((d % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        return d * lane;
      };
      let gap = Infinity;
      if (playerOnLane) gap = Math.min(gap, aheadGap(playerAngle));
      cars.forEach((other, j) => {
        if (j !== i) gap = Math.min(gap, aheadGap(other.angle));
      });

      const target = gap < STOP_GAP ? 0 : gap < SLOW_GAP ? (CRUISE * (gap - STOP_GAP)) / (SLOW_GAP - STOP_GAP) : CRUISE;
      car.braking = target < car.speed - 0.3;
      car.speed = car.braking ? Math.max(target, car.speed - BRAKE * dt) : Math.min(target, car.speed + ACCEL * dt);
      car.angle -= (car.speed / lane) * dt;

      const rb = bodies.current[i];
      if (!rb) return;
      const a = car.angle;
      rb.setNextKinematicTranslation({ x: Math.cos(a) * lane, y: data.ground + 0.66, z: Math.sin(a) * lane });
      // Heading = direction of travel (sin a, -cos a); the car model faces +X.
      q.setFromAxisAngle(up, Math.atan2(Math.cos(a), Math.sin(a)));
      rb.setNextKinematicRotation(q);
    });
  });

  return (
    <>
      {cars.map((car, i) => (
        <RigidBody
          key={i}
          type="kinematicPosition"
          colliders={false}
          ref={(rb) => {
            bodies.current[i] = rb;
          }}
          position={[Math.cos(car.angle) * lane, data.ground + 0.66, Math.sin(car.angle) * lane]}
        >
          <CuboidCollider args={[1.25, 0.45, 0.68]} position={[0, 0.2, 0]} />
          <primitive object={car.group} />
          <CarLights lamps={car.lamps} braking={() => car.braking || car.speed < 0.2} />
        </RigidBody>
      ))}
    </>
  );
}
