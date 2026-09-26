import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useStore } from "../store";
import { autopilot } from "./autopilot";
import { driveStep } from "./driver";
import type { WorldData } from "./World";

function RouteGuide({ data }: { data: WorldData }) {
  const active = useStore((s) => s.pilot.active);
  const geometry = useMemo(() => new THREE.BufferGeometry(), []);
  const line = useMemo(
    () => new THREE.Line(geometry, new THREE.LineDashedMaterial({ color: "#ff6b2c", dashSize: 0.72, gapSize: 0.38, transparent: true, opacity: 0.86, depthWrite: false })),
    [geometry],
  );

  useEffect(() => {
    if (!active) return;
    geometry.setFromPoints(autopilot.path.map(([x, z]) => new THREE.Vector3(x, data.ground + 0.14, z)));
    line.computeLineDistances();
  }, [active, data.ground, geometry, line]);

  useFrame((state) => {
    line.visible = active;
    (line.material as THREE.LineDashedMaterial).opacity = 0.72 + Math.sin(state.clock.elapsedTime * 5) * 0.14;
  });

  line.renderOrder = 2;
  line.frustumCulled = false;
  return <primitive object={line} />;
}

/** Runs the autopilot driver every frame (logic lives in driver.ts so it can be tested headless). */
export function Pilot({ data }: { data: WorldData }) {
  useFrame((state, delta) => driveStep(Math.min(delta, 0.05), state.clock.elapsedTime, data));
  return <RouteGuide data={data} />;
}
