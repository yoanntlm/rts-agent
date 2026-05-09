import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// In-world 3D rendering of the sprite-sheet animations produced by
// `assets-gen/src/animate-building.ts`. Loads the per-frame PNGs as Three.js
// textures, caches them at module scope, and swaps the active texture on the
// material at the animation's suggested FPS.
//
// Sized in tile units (e.g. a 3×3 footprint renders as a 3×3 plane on the
// ground). The center of the plane sits on `position`.

type AnimationMeta = {
  name: string;
  source: string;
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  sheetWidth: number;
  sheetHeight: number;
  suggestedFps: number;
  loop: boolean;
  createdAt: string;
};

type LoadedAnimation = {
  meta: AnimationMeta;
  textures: THREE.Texture[];
};

const ANIM_CACHE = new Map<string, LoadedAnimation>();
const ANIM_PENDING = new Map<string, Promise<LoadedAnimation>>();

function frameUrl(name: string, index: number): string {
  const padded = String(index + 1).padStart(2, "0");
  return `/assets/buildings/animations/${name}/frame-${padded}.png`;
}

function loadFrameTexture(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (tex) => {
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        tex.colorSpace = THREE.SRGBColorSpace;
        resolve(tex);
      },
      undefined,
      reject,
    );
  });
}

async function loadAnimation(name: string): Promise<LoadedAnimation> {
  const cached = ANIM_CACHE.get(name);
  if (cached) return cached;
  const pending = ANIM_PENDING.get(name);
  if (pending) return pending;

  const promise = (async () => {
    const r = await fetch(`/assets/buildings/animations/${name}/meta.json`);
    if (!r.ok) throw new Error(`meta.json fetch failed for ${name}: ${r.status}`);
    const meta = (await r.json()) as AnimationMeta;
    const textures = await Promise.all(
      Array.from({ length: meta.frameCount }, (_, i) => loadFrameTexture(frameUrl(name, i))),
    );
    const loaded: LoadedAnimation = { meta, textures };
    ANIM_CACHE.set(name, loaded);
    ANIM_PENDING.delete(name);
    return loaded;
  })();
  ANIM_PENDING.set(name, promise);
  return promise;
}

type Props = {
  /** Folder under /assets/buildings/animations/, e.g. "construction-zone-3x3". */
  name: string;
  /** Tile-space center of the building. */
  position: { x: number; y: number };
  /** Plane size in tile units (e.g. 3 for the 3×3 construction zone). */
  size?: number;
  /** Slight z offset to layer above the floor and below agents. */
  z?: number;
  /** Override animation's suggestedFps. */
  fps?: number;
  /** Fade-out alpha — 1 by default; pass <1 to dim while finishing the spawn arrival. */
  opacity?: number;
};

export default function BuildingSprite({
  name,
  position,
  size = 3,
  z = 0.05,
  fps,
  opacity = 1,
}: Props) {
  const [anim, setAnim] = useState<LoadedAnimation | null>(() => ANIM_CACHE.get(name) ?? null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const frameRef = useRef(0);
  const lastSwapRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setAnim(ANIM_CACHE.get(name) ?? null);
    loadAnimation(name)
      .then((a) => {
        if (!cancelled) setAnim(a);
      })
      .catch((err) => console.error(`[BuildingSprite:${name}]`, err));
    return () => {
      cancelled = true;
    };
  }, [name]);

  useFrame((state) => {
    if (!anim || !materialRef.current) return;
    const t = state.clock.getElapsedTime();
    const fpsValue = fps ?? anim.meta.suggestedFps;
    const intervalSec = 1 / Math.max(1, fpsValue);
    if (t - lastSwapRef.current >= intervalSec) {
      lastSwapRef.current = t;
      frameRef.current = (frameRef.current + 1) % anim.meta.frameCount;
      const next = anim.textures[frameRef.current];
      if (next && materialRef.current.map !== next) {
        materialRef.current.map = next;
        materialRef.current.needsUpdate = true;
      }
    }
    materialRef.current.opacity = opacity;
  });

  if (!anim) return null;
  const initial = anim.textures[0] ?? null;

  return (
    <mesh position={[position.x + 0.5, position.y + 0.5, z]}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial
        ref={materialRef}
        map={initial ?? undefined}
        transparent
        depthWrite={false}
        toneMapped={false}
        opacity={opacity}
      />
    </mesh>
  );
}
