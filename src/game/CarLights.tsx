import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { getState } from "../store";

const BEAM_LENGTH = 9;

const beamVertex = /* glsl */ `
varying float vAlong;
void main() {
  vAlong = position.x / ${BEAM_LENGTH.toFixed(1)};
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const beamFragment = /* glsl */ `
uniform float uOpacity;
uniform vec3 uColor;
varying float vAlong;
void main() {
  float a = uOpacity * (1.0 - vAlong) * (1.0 - vAlong);
  gl_FragColor = vec4(uColor, a);
}
`;

/** A soft volumetric-looking cone from the lamp (at the origin) forward along +X. */
function beamGeometry() {
  const g = new THREE.ConeGeometry(1.7, BEAM_LENGTH, 20, 1, true);
  g.rotateZ(Math.PI / 2); // apex toward -X, opening toward +X
  g.translate(BEAM_LENGTH / 2, 0, 0); // apex at the lamp
  g.rotateZ(-0.08); // aim slightly at the road
  return g;
}

/** Per-car lamp materials, cloned so each car's lights can change independently. */
export function takeLampMaterials(root: THREE.Object3D) {
  const lamps = { head: null as THREE.MeshStandardMaterial | null, tail: null as THREE.MeshStandardMaterial | null };
  const swap = (mat: THREE.Material) => {
    if (mat.name.startsWith("warm_glow")) return (lamps.head ??= (mat as THREE.MeshStandardMaterial).clone());
    if (mat.name.startsWith("red_glow")) return (lamps.tail ??= (mat as THREE.MeshStandardMaterial).clone());
    return mat;
  };
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.material = Array.isArray(m.material) ? m.material.map(swap) : swap(m.material);
  });
  return lamps;
}

/**
 * Headlight beams (night only) and lamp brightness. `braking()` is polled every frame so the tail lamps
 * flare when the car slows. Lamps sit at the car's front corners in the chassis frame.
 */
export function CarLights({
  lamps,
  braking,
  spot = false,
}: {
  lamps: ReturnType<typeof takeLampMaterials>;
  braking: () => boolean;
  spot?: boolean;
}) {
  const beams = useRef<THREE.Group>(null);
  const geo = useMemo(beamGeometry, []);
  const uniforms = useMemo(() => ({ uOpacity: { value: 0 }, uColor: { value: new THREE.Color("#ffe8b8") } }), []);
  const night = useRef(0);

  useFrame((_, delta) => {
    const isNight = getState().night;
    night.current += ((isNight ? 1 : 0) - night.current) * Math.min(1, delta * 2);
    uniforms.uOpacity.value = night.current * 0.16;
    if (beams.current) beams.current.visible = night.current > 0.02;
    if (lamps.head) lamps.head.emissiveIntensity = 2 + night.current * 6;
    if (lamps.tail) {
      const target = braking() ? 14 : 2 + night.current * 3;
      lamps.tail.emissiveIntensity += (target - lamps.tail.emissiveIntensity) * Math.min(1, delta * 12);
    }
  });

  return (
    <group ref={beams} visible={false}>
      {[-0.45, 0.45].map((z) => (
        <group key={z} position={[1.28, 0.2, z]}>
          <mesh geometry={geo} renderOrder={2}>
            <shaderMaterial
              vertexShader={beamVertex}
              fragmentShader={beamFragment}
              uniforms={uniforms}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
            />
          </mesh>
          {spot && (
            <spotLight angle={0.55} penumbra={0.7} intensity={45} distance={24} color="#ffe6b0">
              <object3D attach="target" position={[8, -1.3, 0]} />
            </spotLight>
          )}
        </group>
      ))}
    </group>
  );
}
