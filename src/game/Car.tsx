import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { CuboidCollider, RigidBody, useBeforePhysicsStep, useRapier, type RapierRigidBody } from "@react-three/rapier";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { bump } from "../audio";
import { getState, setState } from "../store";
import { input, telemetry } from "./controls";
import type { WorldData } from "./World";

type VehicleController = ReturnType<ReturnType<typeof useRapier>["world"]["createVehicleController"]>;

// Chassis frame: +X forward, +Y up, -Z left.
const WHEELS = [
  { pos: new THREE.Vector3(0.8, 0, -0.64), front: true },
  { pos: new THREE.Vector3(0.8, 0, 0.64), front: true },
  { pos: new THREE.Vector3(-0.8, 0, -0.64), front: false },
  { pos: new THREE.Vector3(-0.8, 0, 0.64), front: false },
];
const WHEEL_RADIUS = 0.36;
const REST = 0.32;

const TUNE = {
  mass: 8,
  engine: 18, // per wheel
  boost: 1.6,
  maxSpeed: 17,
  maxReverse: 7,
  brake: 1.2,
  roll: 0.09, // rolling resistance when coasting
  steerLow: 0.55,
  steerHigh: 0.2,
  grip: 2.4,
};

/** Camera sits up and behind at a fixed isometric-ish angle, like a toy diorama. */
const CAM_OFFSET = new THREE.Vector3(13, 13.5, 13);

export function Car({ data }: { data: WorldData }) {
  const { scene } = useGLTF("/world/car.glb");
  const { world } = useRapier();
  const { camera } = useThree();
  const body = useRef<RapierRigidBody>(null);
  const controller = useRef<VehicleController | null>(null);
  const wheelRefs = useRef<(THREE.Object3D | null)[]>([]);
  const headlights = useRef<THREE.Group>(null);

  const { chassis, wheels } = useMemo(() => {
    const chassis = scene.getObjectByName("body")!.clone();
    const wheel = scene.getObjectByName("wheel")!.clone();
    wheel.position.set(0, 0, 0);
    for (const o of [chassis, wheel]) {
      o.traverse((m) => {
        if ((m as THREE.Mesh).isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
    }
    chassis.position.set(0, 0, 0);
    const wheels = WHEELS.map(() => wheel.clone());
    return { chassis, wheels };
  }, [scene]);

  const spawn = useMemo(() => {
    const [x, y, z] = data.spawn.pos;
    return {
      pos: new THREE.Vector3(x, y + 1.2, z),
      rot: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), data.spawn.rotY),
    };
  }, [data]);

  // Build the raycast vehicle once the chassis body exists.
  useEffect(() => {
    const rb = body.current;
    if (!rb) return;
    const v = world.createVehicleController(rb);
    WHEELS.forEach((w, i) => {
      v.addWheel(w.pos, { x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 1 }, REST, WHEEL_RADIUS);
      v.setWheelSuspensionStiffness(i, 38);
      v.setWheelSuspensionCompression(i, 4.4);
      v.setWheelSuspensionRelaxation(i, 2.6);
      v.setWheelMaxSuspensionTravel(i, 0.3);
      v.setWheelFrictionSlip(i, TUNE.grip);
      v.setWheelSideFrictionStiffness(i, 1);
    });
    controller.current = v;
    return () => {
      world.removeVehicleController(v);
      controller.current = null;
    };
  }, [world]);

  const steer = useRef(0);
  useBeforePhysicsStep((w) => {
    const v = controller.current;
    if (!v) return;
    const speed = v.currentVehicleSpeed();
    const panelOpen = getState().panel !== null;
    const throttle = panelOpen ? 0 : input.throttle;
    const steerInput = panelOpen ? 0 : input.steer;

    const t = Math.min(1, Math.abs(speed) / TUNE.maxSpeed);
    const maxSteer = THREE.MathUtils.lerp(TUNE.steerLow, TUNE.steerHigh, t);
    steer.current += (steerInput * maxSteer - steer.current) * 0.2;

    const limit = speed < 0 ? TUNE.maxReverse : TUNE.maxSpeed * (input.boost ? 1.4 : 1);
    const overLimit = Math.sign(throttle) === Math.sign(speed) && Math.abs(speed) > limit;
    const force = overLimit ? 0 : throttle * TUNE.engine * (input.boost ? TUNE.boost : 1);
    const brake = input.brake ? TUNE.brake : throttle === 0 ? TUNE.roll : 0;

    WHEELS.forEach((wh, i) => {
      v.setWheelEngineForce(i, force);
      v.setWheelBrake(i, brake);
      v.setWheelSteering(i, wh.front ? steer.current : 0);
    });
    v.updateVehicle(w.timestep);
  });

  const target = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());
  const tmp = useMemo(() => ({ q: new THREE.Quaternion(), yaw: new THREE.Quaternion(), spin: new THREE.Quaternion(), up: new THREE.Vector3() }), []);
  const lastReset = useRef(0);
  const flippedFor = useRef(0);
  const zoom = useRef(window.innerWidth < window.innerHeight ? 1.35 : 1); // portrait phones see more from further back

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (getState().panel || (e.target as HTMLElement)?.closest?.(".panel, .classic")) return;
      zoom.current = THREE.MathUtils.clamp(zoom.current * (1 + Math.sign(e.deltaY) * 0.08), 0.55, 1.6);
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  function reset(position = spawn.pos, rotation = spawn.rot) {
    const rb = body.current;
    if (!rb) return;
    rb.setTranslation(position, true);
    rb.setRotation(rotation, true);
    rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
    rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  useFrame((state, delta) => {
    const rb = body.current;
    const v = controller.current;
    if (!rb || !v) return;
    const p = rb.translation();
    const r = rb.rotation();
    tmp.q.set(r.x, r.y, r.z, r.w);

    // Wheels follow the simulated suspension, steering and spin.
    WHEELS.forEach((w, i) => {
      const el = wheelRefs.current[i];
      if (!el) return;
      const susp = v.wheelSuspensionLength(i) ?? REST;
      el.position.set(w.pos.x, w.pos.y - susp, w.pos.z);
      tmp.yaw.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, v.wheelSteering(i) ?? 0);
      tmp.spin.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -(v.wheelRotation(i) ?? 0));
      el.quaternion.copy(tmp.yaw).multiply(tmp.spin);
    });

    // Telemetry for sound + minimap.
    const speed = v.currentVehicleSpeed();
    telemetry.speed = speed;
    telemetry.x = p.x;
    telemetry.z = p.z;
    const fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(tmp.q);
    telemetry.heading = Math.atan2(-fwd.z, fwd.x);

    // Reset requests, the sea, and getting stuck on the roof.
    const s = getState();
    if (s.resetTick !== lastReset.current) {
      lastReset.current = s.resetTick;
      reset();
    }
    if (p.y < -3) reset();
    tmp.up.set(0, 1, 0).applyQuaternion(tmp.q);
    flippedFor.current = tmp.up.y < 0.35 && Math.abs(speed) < 2 ? flippedFor.current + delta : 0;
    if (flippedFor.current > 1.2) {
      flippedFor.current = 0;
      const yaw = new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP, telemetry.heading);
      reset(new THREE.Vector3(p.x, p.y + 1.5, p.z), yaw);
    }

    // Which pad are we parked on?
    let zone: string | null = null;
    for (const z of data.zones) {
      const dx = p.x - z.pos[0];
      const dz = p.z - z.pos[2];
      if (dx * dx + dz * dz < z.radius * z.radius) {
        zone = z.id;
        break;
      }
    }
    if (zone !== s.zone) setState({ zone, panel: s.panel && s.panel !== zone ? null : s.panel });

    // Chase camera.
    target.current.set(p.x, p.y, p.z).addScaledVector(CAM_OFFSET, zoom.current);
    const k = 1 - Math.exp(-delta * 4);
    state.camera.position.lerp(target.current, k);
    look.current.lerp(new THREE.Vector3(p.x + fwd.x * 1.5, p.y, p.z + fwd.z * 1.5), k);
    camera.lookAt(look.current);

    if (headlights.current) headlights.current.visible = s.night;
  });

  return (
    <RigidBody
      ref={body}
      position={spawn.pos}
      quaternion={spawn.rot}
      colliders={false}
      canSleep={false}
      angularDamping={0.6}
      linearDamping={0.05}
      onContactForce={(e) => {
        if (e.totalForceMagnitude > 120) bump(Math.min(10, e.totalForceMagnitude / 60));
      }}
    >
      <CuboidCollider args={[1.25, 0.3, 0.68]} position={[0, 0.12, 0]} mass={TUNE.mass} friction={0.4} />
      <primitive object={chassis} />
      {WHEELS.map((w, i) => (
        <primitive
          key={i}
          object={wheels[i]}
          ref={(el: THREE.Object3D | null) => {
            wheelRefs.current[i] = el;
          }}
          position={w.pos}
        />
      ))}
      <group ref={headlights} visible={false}>
        {[-0.42, 0.42].map((z) => (
          <spotLight key={z} position={[1.3, 0.2, z]} angle={0.5} penumbra={0.6} intensity={40} distance={22} color="#ffe6b0">
            <object3D attach="target" position={[8, -1.2, z]} />
          </spotLight>
        ))}
      </group>
    </RigidBody>
  );
}

useGLTF.preload("/world/car.glb");
