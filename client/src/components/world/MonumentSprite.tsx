import { useEffect, useState } from "react";
import * as THREE from "three";

// Renders a Singapore landmark image (from /assets/tiles/) as a flat 3×3
// ground plane at the workshop anchor. Used to swap out the animated
// construction site once the agent finishes its task.
//
// Module-level cache so multiple agents that happened to land on the same
// monument share one decoded texture.

const TEXTURE_CACHE = new Map<string, THREE.Texture>();
const PENDING = new Map<string, Promise<THREE.Texture>>();

function loadTexture(url: string): Promise<THREE.Texture> {
  const cached = TEXTURE_CACHE.get(url);
  if (cached) return Promise.resolve(cached);
  const pending = PENDING.get(url);
  if (pending) return pending;
  const promise = new Promise<THREE.Texture>((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.magFilter = THREE.LinearFilter;
        tex.minFilter = THREE.LinearFilter;
        TEXTURE_CACHE.set(url, tex);
        PENDING.delete(url);
        resolve(tex);
      },
      undefined,
      (err) => {
        PENDING.delete(url);
        reject(err);
      },
    );
  });
  PENDING.set(url, promise);
  return promise;
}

type Props = {
  src: string;
  position: { x: number; y: number };
  size?: number;
  z?: number;
};

export default function MonumentSprite({ src, position, size = 3, z = 0.05 }: Props) {
  const [texture, setTexture] = useState<THREE.Texture | null>(
    () => TEXTURE_CACHE.get(src) ?? null,
  );

  useEffect(() => {
    let cancelled = false;
    setTexture(TEXTURE_CACHE.get(src) ?? null);
    loadTexture(src)
      .then((t) => {
        if (!cancelled) setTexture(t);
      })
      .catch((err) => console.error("[MonumentSprite]", src, err));
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!texture) return null;

  return (
    <mesh position={[position.x + 0.5, position.y + 0.5, z]}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}
