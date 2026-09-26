import { autopilot, stopAutopilot, trace } from "./autopilot";
import { telemetry } from "./controls";
import { lightIsRed, npcs, pedestrians } from "./signals";
import type { WorldData } from "./World";

const CRUISE = 9; // m/s
const LIGHT_STOP = 9; // m before the traffic light
const ARRIVE = 1.5; // m from the pad centre
const CLOSE = 6; // m: the final approach

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

const mem = { status: "", stuckTime: 0, reversing: 0, closeTime: 0 };

/**
 * One tick of the autopilot's pure-pursuit driver. Picks a look-ahead point on the planned route,
 * steers toward it, and chooses a target speed from curvature, distance to the goal, NPC cars
 * ahead and the downtown traffic light. Writes `autopilot.command`, which the car reads.
 */
export function driveStep(dt: number, time: number, data: WorldData) {
  if (!autopilot.active) return;
  const path = autopilot.path;
  const { x, z, speed } = telemetry;
  const fx = Math.cos(telemetry.heading);
  const fz = -Math.sin(telemetry.heading);

  // Advance past waypoints we've reached.
  while (autopilot.index < path.length - 1 && Math.hypot(path[autopilot.index][0] - x, path[autopilot.index][1] - z) < 3.2) autopilot.index++;
  const [ex, ez] = path[path.length - 1];
  const toEnd = Math.hypot(ex - x, ez - z);

  // Arrive on the pad — or, if the turning circle keeps us orbiting it, park as close as we got.
  mem.closeTime = toEnd < CLOSE ? mem.closeTime + dt : 0;
  if (toEnd < ARRIVE || mem.closeTime > 7) {
    autopilot.command = { throttle: 0, steer: 0, brake: true };
    mem.status = "";
    mem.closeTime = 0;
    stopAutopilot(toEnd < ARRIVE ? `Arrived: ${autopilot.label}` : `Parked next to ${autopilot.label}`);
    return;
  }

  // Look-ahead point: first route point at least L metres away.
  const L = 3.5 + Math.abs(speed) * 0.45;
  let [tx, tz] = path[path.length - 1];
  for (let i = autopilot.index; i < path.length; i++) {
    if (Math.hypot(path[i][0] - x, path[i][1] - z) >= L) {
      [tx, tz] = path[i];
      break;
    }
  }
  const err = wrap(Math.atan2(-(tz - z), tx - x) - telemetry.heading);
  let steer = Math.max(-1, Math.min(1, err * 1.8));

  // Target speed: gentle in curves, easing into the goal.
  let target = CRUISE * (1 - Math.min(0.65, Math.abs(err) * 0.9));
  target = Math.min(target, toEnd < CLOSE ? Math.max(1.4, toEnd * 0.5) : 1.2 + toEnd * 0.55);
  let why = "Driving";

  // Yield to NPC cars ahead.
  for (const n of npcs) {
    const dx = n.x - x;
    const dz = n.z - z;
    const ahead = dx * fx + dz * fz;
    const lateral = Math.abs(dx * fz - dz * fx);
    if (ahead > 0 && ahead < 10 && lateral < 1.05) {
      target = Math.min(target, Math.max(0, (ahead - 4.5) * 0.9));
      why = "Braking for traffic";
    }
  }

  // A cautious driver gives a moving person space at the marked city crossings.
  for (const person of pedestrians) {
    const dx = person.x - x;
    const dz = person.z - z;
    const ahead = dx * fx + dz * fz;
    const lateral = Math.abs(dx * fz - dz * fx);
    if (ahead > 0 && ahead < 9 && lateral < 2.1) {
      target = Math.min(target, Math.max(0, (ahead - 3.3) * 0.85));
      why = "Yielding at the crosswalk";
    }
  }

  // Stop at the downtown light when it's red and we're heading into it.
  const [lx, lz] = data.roadGraph.trafficLight;
  const ldx = lx - x;
  const ldz = lz - z;
  const lAhead = ldx * fx + ldz * fz;
  const lDist = Math.hypot(ldx, ldz);
  if (lightIsRed(time) && lAhead > 2 && lDist < LIGHT_STOP + 4 && lAhead / lDist > 0.6) {
    target = Math.min(target, Math.max(0, (lDist - LIGHT_STOP) * 0.8));
    why = "Waiting at the red light";
  }

  let throttle = Math.max(-1, Math.min(1, (target - speed) * 0.45));
  const brake = speed > target + 2.5;

  // Unstick: pushing but not moving for a while → back up with opposite lock.
  if (mem.reversing > 0) {
    mem.reversing -= dt;
    throttle = -0.8;
    steer = -steer;
    why = "Backing out";
  } else if (throttle > 0.3 && Math.abs(speed) < 0.4 && target > 1) {
    mem.stuckTime += dt;
    if (mem.stuckTime > 2.2) {
      mem.stuckTime = 0;
      mem.reversing = 1.3;
    }
  } else mem.stuckTime = 0;

  if (why !== mem.status) {
    mem.status = why;
    trace(why, "doing", true);
  }
  autopilot.command = { throttle, steer, brake };
}
