/**
 * Headless autopilot test: real Rapier vehicle, real road graph and colliders from world.json,
 * the real planner + driver modules. Drives from the spawn to several destinations and checks arrival.
 *
 *   npm run test:autopilot
 */
import RAPIER from "../node_modules/@react-three/rapier/node_modules/@dimforge/rapier3d-compat/rapier.mjs";
import { readFileSync } from "node:fs";
import { autopilot, engage } from "../src/game/autopilot";
import { telemetry } from "../src/game/controls";
import { driveStep } from "../src/game/driver";
import type { WorldData } from "../src/game/World";
import { getState } from "../src/store";

// Keep in sync with TUNE / WHEELS in src/game/Car.tsx.
const TUNE = { mass: 8, engine: 18, maxSpeed: 17, maxReverse: 7, brake: 1.2, roll: 0.09, steerLow: 0.55, steerHigh: 0.2, grip: 2.4 };
const WHEELS = [
  { x: 0.8, z: -0.64, front: true },
  { x: 0.8, z: 0.64, front: true },
  { x: -0.8, z: -0.64, front: false },
  { x: -0.8, z: 0.64, front: false },
];

const data = JSON.parse(readFileSync("public/world/world.json", "utf8")) as WorldData;
const QUERIES = ["something with MCP", "your best AI project", "show me your skills", "downtown", "bowling", "how do I contact you"];

await RAPIER.init({});

function run(query: string) {
  const world = new RAPIER.World({ x: 0, y: -20, z: 0 });
  world.createCollider(RAPIER.ColliderDesc.cuboid(90, 0.5, 90).setTranslation(0, data.ground - 0.5, 0).setFriction(1));
  for (const c of data.colliders) {
    if (c.shape === "box") {
      const q = c.quat ? { x: c.quat[0], y: c.quat[1], z: c.quat[2], w: c.quat[3] } : { x: 0, y: Math.sin((c.rotY ?? 0) / 2), z: 0, w: Math.cos((c.rotY ?? 0) / 2) };
      world.createCollider(RAPIER.ColliderDesc.cuboid(...c.half).setTranslation(...c.pos).setRotation(q));
    } else if (c.shape === "cyl") world.createCollider(RAPIER.ColliderDesc.cylinder(c.halfHeight, c.radius).setTranslation(...c.pos));
  }
  const [sx, sy, sz] = data.spawn.pos;
  const rb = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(sx, sy + 1.2, sz)
      .setRotation({ x: 0, y: Math.sin(data.spawn.rotY / 2), z: 0, w: Math.cos(data.spawn.rotY / 2) })
      .setAngularDamping(0.6)
      .setLinearDamping(0.05)
      .setCanSleep(false),
  );
  world.createCollider(RAPIER.ColliderDesc.cuboid(1.25, 0.3, 0.68).setTranslation(0, 0.12, 0).setMass(TUNE.mass).setFriction(0.4), rb);
  const v = world.createVehicleController(rb);
  WHEELS.forEach((w, i) => {
    v.addWheel({ x: w.x, y: 0, z: w.z }, { x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 1 }, 0.32, 0.36);
    v.setWheelSuspensionStiffness(i, 38);
    v.setWheelSuspensionCompression(i, 4.4);
    v.setWheelSuspensionRelaxation(i, 2.6);
    v.setWheelMaxSuspensionTravel(i, 0.3);
    v.setWheelFrictionSlip(i, TUNE.grip);
    v.setWheelSideFrictionStiffness(i, 1);
  });

  const dt = 1 / 60;
  let steer = 0;
  const sense = () => {
    const p = rb.translation();
    const r = rb.rotation();
    // forward = +X rotated by the body quaternion
    const fx = 1 - 2 * (r.y * r.y + r.z * r.z);
    const fz = 2 * (r.x * r.z - r.w * r.y);
    Object.assign(telemetry, { x: p.x, y: p.y, z: p.z, speed: v.currentVehicleSpeed(), heading: Math.atan2(-fz, fx) });
  };
  for (let i = 0; i < 30; i++) {
    v.updateVehicle(dt);
    world.step();
  }
  sense();
  engage(query, data);
  const goal = autopilot.label;
  let t = 0;
  while (autopilot.active && t < 120) {
    sense();
    driveStep(dt, t, data);
    const cmd = autopilot.command;
    const speed = v.currentVehicleSpeed();
    const maxSteer = TUNE.steerLow + (TUNE.steerHigh - TUNE.steerLow) * Math.min(1, Math.abs(speed) / TUNE.maxSpeed);
    steer += (cmd.steer * maxSteer - steer) * 0.2;
    const limit = speed < 0 ? TUNE.maxReverse : TUNE.maxSpeed;
    const over = Math.sign(cmd.throttle) === Math.sign(speed) && Math.abs(speed) > limit;
    const force = over ? 0 : cmd.throttle * TUNE.engine;
    const brake = cmd.brake ? TUNE.brake : cmd.throttle === 0 ? TUNE.roll : 0;
    WHEELS.forEach((w, i) => {
      v.setWheelEngineForce(i, force);
      v.setWheelBrake(i, brake);
      v.setWheelSteering(i, w.front ? steer : 0);
    });
    v.updateVehicle(dt);
    world.step();
    t += dt;
  }
  const steps = getState().pilot.steps;
  const last = steps[steps.length - 1]?.text ?? "";
  const ok = last.startsWith("Arrived") || last.startsWith("Parked");
  const [ex, ez] = autopilot.path[autopilot.path.length - 1] ?? [NaN, NaN];
  const miss = Math.hypot(telemetry.x - ex, telemetry.z - ez).toFixed(2);
  console.log(`${ok ? "PASS" : "FAIL"}  "${query}" → ${goal || "(no goal)"} in ${t.toFixed(1)} s, ${miss} m from pad${ok ? "" : ` — last: ${last}`}`);
  world.free();
  return ok;
}

const results = QUERIES.map(run);
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} destinations reached`);
process.exit(failed ? 1 : 0);
