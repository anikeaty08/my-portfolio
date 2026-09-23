import { AdaptiveEvents, PerformanceMonitor, Preload } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { scroll } from "../scroll";
import { getState } from "../store";
import { BlackHole } from "./BlackHole";
import { degrade, quality } from "./quality";
import { Universe } from "./Universe";

/** Eases the intro from 0 to 1 once the visitor enters. */
function IntroClock({ intro }: { intro: { current: number } }) {
  useFrame((_, delta) => {
    if (getState().entered) intro.current = Math.min(1, intro.current + delta / 3.2);
  });
  return null;
}

function Effects({ reducedMotion }: { reducedMotion: boolean }) {
  const offset = useMemo(() => new THREE.Vector2(0, 0), []);
  useFrame(() => {
    // Light splits apart as you fall and when you scroll hard.
    const d = scroll.dive;
    const falling = scroll.dive < 0.99 ? Math.pow(d, 3) * 0.004 : 0;
    const speed = Math.min(Math.abs(scroll.velocity) * 0.00012, 0.0025);
    const v = reducedMotion ? 0 : falling + speed;
    offset.set(v, v * 0.6);
  });
  return (
    <EffectComposer multisampling={0}>
      <Bloom mipmapBlur intensity={1.05} luminanceThreshold={0.55} luminanceSmoothing={0.25} radius={0.75} />
      <ChromaticAberration offset={offset} radialModulation modulationOffset={0.2} blendFunction={BlendFunction.NORMAL} />
      <Noise opacity={0.035} premultiply />
      <Vignette eskil={false} offset={0.2} darkness={0.75} />
    </EffectComposer>
  );
}

export function Scene({ reducedMotion, onLost }: { reducedMotion: boolean; onLost: () => void }) {
  const intro = useRef(reducedMotion ? 1 : 0);
  const [dpr, setDpr] = useState(quality.maxDpr);

  return (
    <Canvas
      className="scene"
      dpr={dpr}
      // The HTML overlay sits above the canvas; listen on the page root so portals still get clicks.
      eventSource={document.getElementById("root")!}
      eventPrefix="client"
      gl={{ antialias: false, powerPreference: "high-performance", alpha: false }}
      camera={{ fov: 50, near: 0.1, far: 500, position: [0, 0, 40] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.setClearColor("#000");
        // If the GPU driver resets, drop to the plain HTML site instead of a blank canvas.
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          onLost();
        });
      }}
    >
      <PerformanceMonitor
        onDecline={() => {
          degrade();
          setDpr((d) => Math.max(0.75, d - 0.25));
        }}
        onIncline={() => setDpr((d) => Math.min(quality.maxDpr, d + 0.15))}
      />
      <AdaptiveEvents />
      <IntroClock intro={intro} />
      <BlackHole intro={intro} />
      <Suspense fallback={null}>
        <Universe />
        <Preload all />
      </Suspense>
      {!new URLSearchParams(window.location.search).has("nofx") && <Effects reducedMotion={reducedMotion} />}
    </Canvas>
  );
}
