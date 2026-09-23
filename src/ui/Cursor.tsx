import { useEffect, useRef } from "react";
import { quality } from "../three/quality";
import { useLoop } from "./useLoop";

/** A ring that trails the pointer. Over the hero, the shader draws a real lens inside it. */
export function Cursor() {
  const ring = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: -100, y: -100, tx: -100, ty: -100 });

  useEffect(() => {
    const move = (e: PointerEvent) => {
      pos.current.tx = e.clientX;
      pos.current.ty = e.clientY;
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);

  useLoop(() => {
    const p = pos.current;
    p.x += (p.tx - p.x) * 0.22;
    p.y += (p.ty - p.y) * 0.22;
    if (ring.current) ring.current.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
  });

  if (!quality.pointerFine) return null;
  return (
    <div className="cursor" ref={ring} aria-hidden>
      <div className="cursor__ring" />
      <span className="cursor__label mono">Enter</span>
    </div>
  );
}
