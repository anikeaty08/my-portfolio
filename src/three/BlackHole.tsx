import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { person } from "../content";
import { fallRadius, ORBIT_R } from "../descent";
import { scroll } from "../scroll";
import { blackholeFragment, blackholeVertex } from "./blackholeShader";
import { quality } from "./quality";

/** Renders the name onto a canvas so the shader can lens it as a background layer. */
function makeNameTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 640;
  const ctx = canvas.getContext("2d")!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;

  const draw = () => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "800 250px Syne, 'Arial Black', sans-serif";
    ctx.fillText(person.first, canvas.width / 2, canvas.height * 0.3);
    ctx.fillText(person.last, canvas.width / 2, canvas.height * 0.74);
    tex.needsUpdate = true;
  };
  draw();
  document.fonts?.load("800 250px Syne").then(draw, () => undefined);
  return { tex, aspect: canvas.width / canvas.height };
}

/**
 * The ray tracer is by far the most expensive thing on the page, so it renders into an
 * offscreen HDR target at a fraction of the canvas resolution and is upscaled to the screen.
 */
export function BlackHole({ intro }: { intro: { current: number } }) {
  const display = useRef<THREE.Mesh>(null);
  const { gl, size, viewport } = useThree();
  const name = useMemo(makeNameTexture, []);

  const target = useMemo(
    () =>
      new THREE.WebGLRenderTarget(1, 1, {
        type: THREE.HalfFloatType,
        depthBuffer: false,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
      }),
    [],
  );

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uRes: { value: new THREE.Vector2() },
      uDist: { value: 26 },
      uElev: { value: 0.12 },
      uAzim: { value: 0 },
      uRoll: { value: 0 },
      uFocal: { value: 1.6 },
      uSteps: { value: quality.steps },
      uCursor: { value: new THREE.Vector2(0.5, 0.5) },
      uCursorMass: { value: 0 },
      uFade: { value: 0 },
      uText: { value: name.tex },
      uTextAspect: { value: name.aspect },
    }),
    [name],
  );

  const pass = useMemo(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const material = new THREE.ShaderMaterial({
      vertexShader: blackholeVertex,
      fragmentShader: blackholeFragment,
      uniforms,
      depthWrite: false,
      depthTest: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    scene.add(quad);
    return { scene, camera, material, quad };
  }, [uniforms]);

  useEffect(
    () => () => {
      target.dispose();
      pass.material.dispose();
      pass.quad.geometry.dispose();
      name.tex.dispose();
    },
    [target, pass, name],
  );

  const scale = useRef(quality.traceScale);
  useEffect(() => {
    const w = Math.max(2, Math.round(size.width * viewport.dpr * quality.traceScale));
    const h = Math.max(2, Math.round(size.height * viewport.dpr * quality.traceScale));
    target.setSize(w, h);
    uniforms.uRes.value.set(w, h);
    scale.current = quality.traceScale;
  }, [size, viewport.dpr, target, uniforms]);

  useFrame((state) => {
    const u = uniforms;
    const d = scroll.dive;
    const i = intro.current; // 0 → 1 once the loader is dismissed
    const visible = d < 0.985;
    if (display.current) display.current.visible = visible;
    if (!visible) return;

    // The PerformanceMonitor may have lowered the trace resolution.
    if (scale.current !== quality.traceScale) {
      scale.current = quality.traceScale;
      const w = Math.max(2, Math.round(size.width * viewport.dpr * scale.current));
      const h = Math.max(2, Math.round(size.height * viewport.dpr * scale.current));
      target.setSize(w, h);
      u.uRes.value.set(w, h);
    }

    u.uTime.value = state.clock.elapsedTime;
    u.uSteps.value = quality.steps;
    // Start far away during the intro, settle into orbit, then fall in with scroll.
    u.uDist.value = fallRadius(d, ORBIT_R + (1 - easeOut(i)) * 40);
    u.uElev.value = 0.1 + scroll.my * 0.07 + (1 - i) * 0.25 + d * 0.12;
    u.uAzim.value = scroll.mx * 0.28 + d * 1.6 + (1 - i) * -0.8;
    u.uRoll.value = scroll.mx * -0.04 + d * d * 1.1;
    u.uFocal.value = THREE.MathUtils.lerp(1.55, 0.8, d);
    u.uFade.value = THREE.MathUtils.smoothstep(d, 0.88, 0.97);
    u.uCursor.value.set(scroll.px, scroll.py);
    const lensTarget = quality.pointerFine ? (1 - THREE.MathUtils.smoothstep(d, 0.02, 0.2)) * i : 0;
    u.uCursorMass.value += (lensTarget - u.uCursorMass.value) * 0.08;

    const prev = gl.getRenderTarget();
    gl.setRenderTarget(target);
    gl.render(pass.scene, pass.camera);
    gl.setRenderTarget(prev);
  }, -1);

  return (
    <mesh ref={display} frustumCulled={false} renderOrder={-10}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={blackholeVertex}
        fragmentShader={/* glsl */ `
          uniform sampler2D uTex;
          varying vec2 vUv;
          void main() { gl_FragColor = texture2D(uTex, vUv); }
        `}
        uniforms={{ uTex: { value: target.texture } }}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3);
}
