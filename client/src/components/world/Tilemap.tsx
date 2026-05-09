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

function sectorDividers(width: number, height: number) {
  return [
    ...[Math.floor(width * 0.25), Math.floor(width * 0.5), Math.floor(width * 0.75)].map((x) => ({
      x,
      y: height / 2,
      width: 0.08,
      height: height - 2,
      color: "#4ECDC4",
    })),
    ...[Math.floor(height * 0.33), Math.floor(height * 0.66)].map((y) => ({
      x: width / 2,
      y,
      width: width - 2,
      height: 0.08,
      color: "#A78BFA",
    })),
  ];
}

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
  const sectors = useMemo(() => sectorDividers(width, height), [width, height]);
  const gridPositions = useMemo(
    () =>
      new Float32Array(
        Array.from({ length: width + 1 + height + 1 }, (_, i) => {
          if (i <= width) return [i, 0, 0, i, height, 0];
          const y = i - width - 1;
          return [0, y, 0, width, y, 0];
        }).flat(),
      ),
    [width, height],
  );

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

      {sectors.map((sector, index) => (
        <mesh key={index} position={[sector.x, sector.y, 0.045]}>
          <planeGeometry args={[sector.width, sector.height]} />
          <meshBasicMaterial color={sector.color} transparent opacity={0.18} depthWrite={false} />
        </mesh>
      ))}

      <lineSegments position={[0, 0, 0.07]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={gridPositions.length / 3}
            array={gridPositions}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#ffffff" transparent opacity={0.03} />
      </lineSegments>
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
