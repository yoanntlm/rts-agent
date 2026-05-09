import { useMemo } from "react";

type Props = { width: number; height: number };

const GRASS_A = "#1f2a18";
const GRASS_B = "#243018";
const WORKSHOP = "#3b2a16";

// Static for the hackathon. H6 swaps in real generated tile textures.
export default function Tilemap({ width, height }: Props) {
  const tiles = useMemo(() => {
    const out: { x: number; y: number; color: string }[] = [];
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const isWorkshop = x === Math.floor(width / 2) && y === Math.floor(height / 2);
        const color = isWorkshop ? WORKSHOP : (x + y) % 2 === 0 ? GRASS_A : GRASS_B;
        out.push({ x, y, color });
      }
    }
    return out;
  }, [width, height]);

  return (
    <group>
      {tiles.map((t) => (
        <mesh key={`${t.x},${t.y}`} position={[t.x + 0.5, t.y + 0.5, 0]}>
          <planeGeometry args={[0.98, 0.98]} />
          <meshBasicMaterial color={t.color} />
        </mesh>
      ))}
    </group>
  );
}
