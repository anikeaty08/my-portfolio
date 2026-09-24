import { useFrame } from "@react-three/fiber";
import { driveStep } from "./driver";
import type { WorldData } from "./World";

/** Runs the autopilot driver every frame (logic lives in driver.ts so it can be tested headless). */
export function Pilot({ data }: { data: WorldData }) {
  useFrame((state, delta) => driveStep(Math.min(delta, 0.05), state.clock.elapsedTime, data));
  return null;
}
