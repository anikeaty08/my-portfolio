import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { CuboidCollider, RigidBody, useBeforePhysicsStep, useRapier, type RapierRigidBody } from "@react-three/rapier";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { bump, horn, splash } from "../audio";
import { getState, setState, useStore } from "../store";
import { SKINS, unlock } from "./achievements";
import { bakeRelativeTo } from "./bake";
import { CarLights, takeLampMaterials } from "./CarLights";
import { input, pollGamepad, telemetry } from "./controls";
import { effects } from "./Effects";
import { teleportTarget } from "./Gameplay";
import { INTERACTIVE, type WorldData } from "./World";

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

// Checked with a headless Rapier simulation: 0→8.6 m/s in 1 s, capped at 17 m/s, reverse 7 m/s.
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
const CAM_DIST = 22.5;
const CAM_PITCH = 0.64; // radians above the horizon
const CAM_YAW = Math.PI / 4; // looking from +X/+Z
/** Before start the camera holds the Blender hero-render framing, then swoops down to the car. */
const INTRO_FROM = new THREE.Vector3(58, 44, 58); // the Blender hero camera, in three.js space
const INTRO_LOOK = new THREE.Vector3(0, 0, -4);
const INTRO_SECONDS = 2.8;

export function Car({ data }: { data: WorldData }) {
  const { scene } = useGLTF("/world/car.glb");
  const { world } = useRapier();
  const { camera, gl } = useThree();
  const body = useRef<RapierRigidBody>(null);
  const controller = useRef<VehicleController | null>(null);
  const wheelRefs = useRef<(THREE.Object3D | null)[]>([]);
  const skin = useStore((s) => s.skin);

  const { chassis, wheels, paint, lamps } = useMemo(() => {
    // Bake out the meshopt dequantization transforms; the chassis stays in the car frame.
    const chassis = bakeRelativeTo(scene.getObjectByName("body")!, new THREE.Matrix4());
    const wheel = bakeRelativeTo(scene.getObjectByName("wheel")!, new THREE.Matrix4());
    // The wheel is modeled off to the side; recenter it on its axle.
    const center = new THREE.Box3().setFromObject(wheel).getCenter(new THREE.Vector3());
    wheel.children.forEach((m) => (m as THREE.Mesh).geometry.translate(-center.x, -center.y, -center.z));
    let paint: THREE.MeshStandardMaterial | null = null;
    // The body paint gets its own material so skins can recolor it.
    const swap = (mat: THREE.Material) => (mat.name === "orange" ? (paint ??= (mat as THREE.MeshStandardMaterial).clone()) : mat);
    for (const o of [chassis, wheel]) {
      o.traverse((m) => {
        const mesh = m as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
      });
    }
    const wheels = WHEELS.map(() => wheel.clone());
    const lamps = takeLampMaterials(chassis);
    return { chassis, wheels, paint: paint as THREE.MeshStandardMaterial | null, lamps };
  }, [scene]);

  useEffect(() => {
    if (!paint) return;
    paint.color.set(SKINS.find((s) => s.id === skin)?.color ?? SKINS[0].color);
    paint.metalness = skin === "gold" ? 0.9 : 0.1;
    paint.roughness = skin === "gold" ? 0.25 : 0.45;
  }, [skin, paint]);

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
    if (pollGamepad()) honk();
    const speed = v.currentVehicleSpeed();
    const s = getState();
    const locked = s.panel !== null || !s.started;
    const throttle = locked ? 0 : input.throttle;
    const steerInput = locked ? 0 : input.steer;

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

  // ---------------------------------------------------------------- camera: drag to orbit, wheel to zoom
  const cam = useRef({ yaw: CAM_YAW, yawTarget: CAM_YAW, zoom: window.innerWidth < window.innerHeight ? 1.35 : 1, speedZoom: 0, intro: 0 });
  useEffect(() => {
    const el = gl.domElement;
    let dragging: { x: number; id: number } | null = null;
    const down = (e: PointerEvent) => {
      if (e.pointerType === "touch") return; // touch is for the joystick
      dragging = { x: e.clientX, id: e.pointerId };
    };
    const move = (e: PointerEvent) => {
      if (!dragging || dragging.id !== e.pointerId) return;
      cam.current.yawTarget -= (e.clientX - dragging.x) * 0.006;
      dragging.x = e.clientX;
    };
    const up = () => {
      dragging = null;
    };
    const wheel = (e: WheelEvent) => {
      if (getState().panel || (e.target as HTMLElement)?.closest?.(".panel, .classic, .trophies")) return;
      cam.current.zoom = THREE.MathUtils.clamp(cam.current.zoom * (1 + Math.sign(e.deltaY) * 0.08), 0.55, 1.7);
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("wheel", wheel, { passive: true });
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("wheel", wheel);
    };
  }, [gl]);

  function place(position: THREE.Vector3, rotation: THREE.Quaternion) {
    const rb = body.current;
    if (!rb) return;
    rb.setTranslation(position, true);
    rb.setRotation(rotation, true);
    rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
    rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  function honk() {
    horn();
    unlock("horn");
    effects.honkAt = performance.now();
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyH" && !e.repeat && !(e.target as HTMLElement)?.closest?.("input, textarea")) honk();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const tmp = useMemo(
    () => ({
      q: new THREE.Quaternion(),
      yaw: new THREE.Quaternion(),
      spin: new THREE.Quaternion(),
      up: new THREE.Vector3(),
      fwd: new THREE.Vector3(),
      target: new THREE.Vector3(),
      look: new THREE.Vector3(),
      lookTarget: new THREE.Vector3(),
      axle: new THREE.Vector3(0, 0, 1),
    }),
    [],
  );
  const last = useRef({ reset: 0, teleport: 0, flipped: 0, splashed: false });

  useFrame((state, delta) => {
    const rb = body.current;
    const v = controller.current;
    if (!rb || !v) return;
    const p = rb.translation();
    const r = rb.rotation();
    const vel = rb.linvel();
    tmp.q.set(r.x, r.y, r.z, r.w);

    // Wheels follow the simulated suspension, steering and spin.
    WHEELS.forEach((w, i) => {
      const el = wheelRefs.current[i];
      if (!el) return;
      const susp = v.wheelSuspensionLength(i) ?? REST;
      el.position.set(w.pos.x, w.pos.y - susp, w.pos.z);
      tmp.yaw.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, v.wheelSteering(i) ?? 0);
      tmp.spin.setFromAxisAngle(tmp.axle, -(v.wheelRotation(i) ?? 0));
      el.quaternion.copy(tmp.yaw).multiply(tmp.spin);
      const tw = telemetry.wheels[i];
      const contact = v.wheelContactPoint(i);
      tw.contact = v.wheelIsInContact(i);
      if (contact) tw.pos.set(contact.x, contact.y, contact.z);
      tw.slip = Math.abs(v.wheelSideImpulse(i) ?? 0);
    });

    // Telemetry for sound, effects and the minimap.
    const speed = v.currentVehicleSpeed();
    telemetry.speed = speed;
    telemetry.x = p.x;
    telemetry.y = p.y;
    telemetry.z = p.z;
    telemetry.vx = vel.x;
    telemetry.vz = vel.z;
    tmp.fwd.set(1, 0, 0).applyQuaternion(tmp.q);
    telemetry.heading = Math.atan2(-tmp.fwd.z, tmp.fwd.x);

    // Reset / teleport requests, the sea, and getting stuck on the roof.
    const s = getState();
    const L = last.current;
    if (s.resetTick !== L.reset) {
      L.reset = s.resetTick;
      place(spawn.pos, spawn.rot);
    }
    if (s.teleport && s.teleport.key !== L.teleport) {
      L.teleport = s.teleport.key;
      const t = teleportTarget(data, s.teleport.zone);
      if (t) place(t.pos, t.rot);
    }
    if (p.y < -0.4 && !L.splashed) {
      L.splashed = true;
      splash();
      unlock("splash");
      effects.splashAt = { t: state.clock.elapsedTime, x: p.x, z: p.z };
    }
    if (p.y < -3) {
      L.splashed = false;
      place(spawn.pos, spawn.rot);
    }
    tmp.up.set(0, 1, 0).applyQuaternion(tmp.q);
    L.flipped = tmp.up.y < 0.35 && Math.abs(speed) < 2 ? L.flipped + delta : 0;
    if (L.flipped > 1.2) {
      L.flipped = 0;
      place(new THREE.Vector3(p.x, p.y + 1.5, p.z), new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP, telemetry.heading));
    }

    // Which pad are we parked on?
    let zone: string | null = null;
    for (const z of data.zones) {
      if (!INTERACTIVE.includes(z.kind)) continue;
      const dx = p.x - z.pos[0];
      const dz = p.z - z.pos[2];
      if (dx * dx + dz * dz < z.radius * z.radius) {
        zone = z.id;
        break;
      }
    }
    // Driving off a pad closes its panel; panels opened from the menu stay open.
    if (zone !== s.zone) setState({ zone, panel: s.panel && s.panel === s.zone ? null : s.panel });

    // Chase camera: eases toward the car, leads in the direction of travel, pulls back with speed.
    const c = cam.current;
    c.yaw += (c.yawTarget - c.yaw) * (1 - Math.exp(-delta * 6));
    c.speedZoom += (Math.min(Math.abs(speed) / TUNE.maxSpeed, 1.3) * 0.22 - c.speedZoom) * (1 - Math.exp(-delta * 1.5));
    const dist = CAM_DIST * c.zoom * (1 + c.speedZoom);
    tmp.target.set(Math.sin(c.yaw) * Math.cos(CAM_PITCH), Math.sin(CAM_PITCH), Math.cos(c.yaw) * Math.cos(CAM_PITCH)).multiplyScalar(dist);
    tmp.lookTarget.set(p.x + vel.x * 0.35, p.y, p.z + vel.z * 0.35);
    tmp.target.add(tmp.lookTarget);
    if (c.intro < 1) {
      // Opening shot: hold the hero framing until start, then an eased swoop onto the car.
      if (s.started) c.intro = Math.min(1, c.intro + delta / INTRO_SECONDS);
      const e = c.intro < 0.5 ? 4 * c.intro ** 3 : 1 - (-2 * c.intro + 2) ** 3 / 2;
      state.camera.position.lerpVectors(INTRO_FROM, tmp.target, e);
      tmp.look.lerpVectors(INTRO_LOOK, tmp.lookTarget, e);
      camera.lookAt(tmp.look);
    } else {
      const k = 1 - Math.exp(-delta * 5);
      state.camera.position.lerp(tmp.target, k);
      tmp.look.lerp(tmp.lookTarget, k);
      camera.lookAt(tmp.look);
    }

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
      <CarLights
        lamps={lamps}
        spot
        braking={() => input.brake || (input.throttle < 0 && telemetry.speed > 1) || (input.throttle > 0 && telemetry.speed < -1)}
      />
    </RigidBody>
  );
}

useGLTF.preload("/world/car.glb");
