import { useEffect, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import * as THREE from "three";
import {
  FALLBACK_COLOR,
  useTileTextures,
  type TileKind,
} from "../../lib/tiles";

type Props = {
  width: number;
  height: number;
  tiles: TileKind[]; // row-major, length === width * height
  onPaint: (x: number, y: number) => void;
};

export default function EditorCanvas({ width, height, tiles, onPaint }: Props) {
  // Fit zoom so the map fills ~85% of the viewport.
  const padding = 1.15;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 720;
  const zoom = Math.max(8, Math.min(vw / (width * padding), vh / (height * padding)));

  return (
    <Canvas
      gl={{ antialias: true }}
      style={{ background: "#0c0a09", touchAction: "none" }}
      orthographic
    >
      <OrthographicCamera
        makeDefault
        position={[width / 2, height / 2, 50]}
        zoom={zoom}
        near={0.1}
        far={1000}
      />
      <ambientLight intensity={1} />
      <Tiles width={width} height={height} tiles={tiles} />
      <PaintInteraction width={width} height={height} onPaint={onPaint} />
      <BorderFrame width={width} height={height} />
    </Canvas>
  );
}

function Tiles({
  width,
  height,
  tiles,
}: {
  width: number;
  height: number;
  tiles: TileKind[];
}) {
  const textures = useTileTextures();

  return (
    <group>
      {tiles.map((kind, i) => {
        const x = i % width;
        const y = Math.floor(i / width);
        const tex = textures[kind];
        return (
          <mesh key={i} position={[x + 0.5, y + 0.5, 0]}>
            <planeGeometry args={[1, 1]} />
            {tex ? (
              <meshBasicMaterial map={tex} toneMapped={false} />
            ) : (
              <meshBasicMaterial color={FALLBACK_COLOR[kind]} />
            )}
          </mesh>
        );
      })}
    </group>
  );
}

// Native-DOM pointer events on the canvas element. R3F's synthetic pointer
// events don't reliably fire on intermediate meshes during a drag (implicit
// pointer capture sticks the events to the original target), so we bypass
// them entirely: listen on gl.domElement, unproject screen → world via the
// camera, and floor to tile coords.
function PaintInteraction({
  width,
  height,
  onPaint,
}: {
  width: number;
  height: number;
  onPaint: (x: number, y: number) => void;
}) {
  const { gl, camera } = useThree();
  const paintingRef = useRef(false);
  const onPaintRef = useRef(onPaint);
  onPaintRef.current = onPaint;
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = gl.domElement;
    const v = new THREE.Vector3();

    const tileFor = (e: PointerEvent): { x: number; y: number } | null => {
      const rect = canvas.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      v.set(ndcX, ndcY, 0).unproject(camera);
      const x = Math.floor(v.x);
      const y = Math.floor(v.y);
      if (x < 0 || y < 0 || x >= width || y >= height) return null;
      return { x, y };
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return; // left button only
      const t = tileFor(e);
      if (!t) return;
      paintingRef.current = true;
      onPaintRef.current(t.x, t.y);
      // Keep receiving events even if pointer leaves the canvas mid-drag.
      canvas.setPointerCapture?.(e.pointerId);
    };

    const onMove = (e: PointerEvent) => {
      const t = tileFor(e);
      setHover(t);
      if (t && paintingRef.current) onPaintRef.current(t.x, t.y);
    };

    const onUp = () => {
      paintingRef.current = false;
    };

    const onLeave = () => setHover(null);

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [gl, camera, width, height]);

  if (!hover) return null;
  return (
    <mesh position={[hover.x + 0.5, hover.y + 0.5, 0.01]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.22} depthWrite={false} />
    </mesh>
  );
}

function BorderFrame({ width, height }: { width: number; height: number }) {
  // Thin amber outline so the map's bounds are obvious even when edges are
  // similar-colored grass tiles.
  const t = 0.06;
  return (
    <group>
      <mesh position={[width / 2, -t / 2, 0.02]}>
        <planeGeometry args={[width + t * 2, t]} />
        <meshBasicMaterial color="#fbbf24" />
      </mesh>
      <mesh position={[width / 2, height + t / 2, 0.02]}>
        <planeGeometry args={[width + t * 2, t]} />
        <meshBasicMaterial color="#fbbf24" />
      </mesh>
      <mesh position={[-t / 2, height / 2, 0.02]}>
        <planeGeometry args={[t, height + t * 2]} />
        <meshBasicMaterial color="#fbbf24" />
      </mesh>
      <mesh position={[width + t / 2, height / 2, 0.02]}>
        <planeGeometry args={[t, height + t * 2]} />
        <meshBasicMaterial color="#fbbf24" />
      </mesh>
    </group>
  );
}
