import { useEffect, useMemo, useState } from "react";
import {
  FALLBACK_COLOR,
  buildProceduralTiles,
  useTileTextures,
  type TileKind,
} from "../../lib/tiles";
import { loadFromStorage } from "../../lib/savedMap";

type Props = {
  width: number;
  height: number;
  // Optional explicit tiles override (row-major, length === width * height).
  // If omitted, the component reads localStorage; if that's missing or its
  // dimensions differ, it falls back to a procedural fill.
  tiles?: TileKind[];
};

export default function Tilemap({ width, height, tiles: explicit }: Props) {
  const tiles = useMemo<TileKind[]>(() => {
    if (explicit && explicit.length === width * height) return explicit;
    const saved = loadFromStorage();
    if (saved && saved.width === width && saved.height === height) {
      return saved.tiles;
    }
    return buildProceduralTiles(width, height);
  }, [width, height, explicit]);

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

// Re-render when localStorage changes in another tab (e.g. user saved in /editor
// then switched back to the game tab). We listen here rather than in tiles.ts so
// the editor doesn't pay the cost.
export function useReloadOnStorageChange(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "worldbuilder.map.v1") setN((v) => v + 1);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return n;
}
