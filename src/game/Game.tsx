import { AdaptiveDpr, PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useStore } from "../store";
import { Car } from "./Car";
import { Effects } from "./Effects";
import { Gameplay } from "./Gameplay";
import { LiveBoard } from "./LiveBoard";
import { Nature } from "./Nature";
import { Pilot } from "./Pilot";
import { Traffic } from "./Traffic";
import { telemetry } from "./controls";
import { quality } from "./quality";
import { useWorldData, World } from "./World";

const DAY = { sky: new THREE.Color("#a8d8f4"), hemiSky: new THREE.Color("#dff1ff"), hemiGround: new THREE.Color("#8fbf6a"), hemi: 1.35, sun: 2.6, sunColor: new THREE.Color("#fff1dc") };
const NIGHT = { sky: new THREE.Color("#16224d"), hemiSky: new THREE.Color("#6f86d6"), hemiGround: new THREE.Color("#23402f"), hemi: 0.95, sun: 0.75, sunColor: new THREE.Color("#a9bcff") };

/** Sun + sky that ease between day and night, with the shadow camera following the car. */
function Environment() {
  const night = useStore((s) => s.night);
  const { scene } = useThree();
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const mix = useRef(0);
  const colors = useMemo(() => ({ sky: new THREE.Color() }), []);

  useEffect(() => {
    scene.background = new THREE.Color(DAY.sky);
    scene.fog = new THREE.Fog(DAY.sky, 90, 260);
  }, [scene]);

  useFrame((_, delta) => {
    mix.current += ((night ? 1 : 0) - mix.current) * Math.min(1, delta * 2);
    const m = mix.current;
    colors.sky.copy(DAY.sky).lerp(NIGHT.sky, m);
    (scene.background as THREE.Color).copy(colors.sky);
    (scene.fog as THREE.Fog).color.copy(colors.sky);
    if (hemi.current) {
      hemi.current.intensity = THREE.MathUtils.lerp(DAY.hemi, NIGHT.hemi, m);
      hemi.current.color.copy(DAY.hemiSky).lerp(NIGHT.hemiSky, m);
      hemi.current.groundColor.copy(DAY.hemiGround).lerp(NIGHT.hemiGround, m);
    }
    if (sun.current) {
      sun.current.intensity = THREE.MathUtils.lerp(DAY.sun, NIGHT.sun, m);
      sun.current.color.copy(DAY.sunColor).lerp(NIGHT.sunColor, m);
      sun.current.position.set(telemetry.x + 18, 30, telemetry.z + 8);
      sun.current.target.position.set(telemetry.x, 0, telemetry.z);
      sun.current.target.updateMatrixWorld();
    }
  });

  const S = 28;
  return (
    <>
      <hemisphereLight ref={hemi} args={[DAY.hemiSky, DAY.hemiGround, DAY.hemi]} />
      <directionalLight
        ref={sun}
        castShadow
        intensity={DAY.sun}
        shadow-mapSize={[quality.shadowMap, quality.shadowMap]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.04}
        shadow-camera-left={-S}
        shadow-camera-right={S}
        shadow-camera-top={S}
        shadow-camera-bottom={-S}
        shadow-camera-near={1}
        shadow-camera-far={90}
      />
    </>
  );
}

function Level() {
  const data = useWorldData();
  const started = useStore((s) => s.started);
  const moon = useStore((s) => s.moon);
  const debug = new URLSearchParams(window.location.search).has("debug");
  return (
    <>
      <Nature data={data} />
      {/* Paused until the visitor starts, so the letters of the name drop in on cue. */}
      <Physics gravity={[0, moon ? -5 : -20, 0]} paused={!started} debug={debug}>
        <World data={data} />
        <Car data={data} />
        <Gameplay data={data} />
        <Traffic data={data} />
        <Pilot data={data} />
      </Physics>
      <Effects />
      <LiveBoard data={data} />
    </>
  );
}

export function Game({ onLost }: { onLost: () => void }) {
  const [dpr, setDpr] = useState(Math.min(window.devicePixelRatio, quality.maxDpr));
  return (
    <Canvas
      className="scene"
      shadows={quality.shadows}
      dpr={dpr}
      gl={{ antialias: quality.antialias, powerPreference: "high-performance" }}
      camera={{ fov: 38, near: 0.5, far: 500, position: [58, 44, 58] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          onLost();
        });
      }}
    >
      <PerformanceMonitor onDecline={() => setDpr((d) => Math.max(0.75, d - 0.25))} />
      <AdaptiveDpr pixelated={false} />
      <Environment />
      <Suspense fallback={null}>
        <Level />
      </Suspense>
    </Canvas>
  );
}
