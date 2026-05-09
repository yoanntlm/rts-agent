import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type Props = { width: number; height: number };

type TileInstance = {
  x: number;
  y: number;
  color: string;
};

type DetailInstance = TileInstance & {
  size: number;
};

const GRASS_COLORS = ["#12352e", "#173d31", "#1d4a35", "#0e3a3d", "#21462b"];
const WATER_COLORS = ["#041421", "#061b2d", "#08243a", "#0b2f44"];
const WORKSHOP_COLORS = ["#4a2a12", "#5f3515", "#7a4a1d", "#8a5b24"];
const DETAIL_COLORS = ["#26372f", "#46505a", "#4ECDC4", "#FFD166", "#A78BFA"];
const GRID_COLOR = new THREE.Color("#ffffff");
const MATRIX = new THREE.Matrix4();
const COLOR = new THREE.Color();

function hash(x: number, y: number, seed = 0) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function isWater(x: number, y: number, width: number, height: number) {
  return x === 0 || y === 0 || x === width - 1 || y === height - 1;
}

function workshopCenters(width: number, height: number) {
  return [
    { x: Math.floor(width * 0.28), y: Math.floor(height * 0.28) },
    { x: Math.floor(width * 0.72), y: Math.floor(height * 0.28) },
    { x: Math.floor(width * 0.28), y: Math.floor(height * 0.72) },
    { x: Math.floor(width * 0.72), y: Math.floor(height * 0.72) },
  ];
}

function isWorkshop(x: number, y: number, centers: { x: number; y: number }[]) {
  return centers.some((c) => Math.abs(x - c.x) <= 1 && Math.abs(y - c.y) <= 1);
}

function paletteColor(colors: string[], value: number) {
  return colors[Math.floor(value * colors.length)] ?? colors[0] ?? "#ffffff";
}

function writeInstances(
  mesh: THREE.InstancedMesh | null,
  instances: TileInstance[],
  z: number,
  scale = 0.98,
) {
  if (!mesh) return;
  instances.forEach((tile, i) => {
    MATRIX.makeScale(scale, scale, 1);
    MATRIX.setPosition(tile.x + 0.5, tile.y + 0.5, z);
    mesh.setMatrixAt(i, MATRIX);
    mesh.setColorAt(i, COLOR.set(tile.color));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

// Static for the hackathon. H6 swaps in real generated tile textures.
export default function Tilemap({ width, height }: Props) {
  const grassRef = useRef<THREE.InstancedMesh>(null);
  const waterRef = useRef<THREE.InstancedMesh>(null);
  const workshopRef = useRef<THREE.InstancedMesh>(null);
  const detailRef = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);
  const waterMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const glowMaterialRef = useRef<THREE.MeshBasicMaterial>(null);

  const { grass, water, workshops, details, centers, gridPositions } = useMemo(() => {
    const centers = workshopCenters(width, height);
    const grass: TileInstance[] = [];
    const water: TileInstance[] = [];
    const workshops: TileInstance[] = [];
    const details: DetailInstance[] = [];

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        if (isWater(x, y, width, height)) {
          water.push({
            x,
            y,
            color: paletteColor(WATER_COLORS, hash(x, y, 1)),
          });
          continue;
        }

        if (isWorkshop(x, y, centers)) {
          workshops.push({
            x,
            y,
            color: paletteColor(WORKSHOP_COLORS, hash(x, y, 2)),
          });
          continue;
        }

        grass.push({
          x,
          y,
          color: paletteColor(GRASS_COLORS, hash(x, y, 3)),
        });

        if (hash(x, y, 4) < 0.15) {
          details.push({
            x: x + 0.22 + hash(x, y, 5) * 0.56,
            y: y + 0.22 + hash(x, y, 6) * 0.56,
            size: 0.08 + hash(x, y, 7) * 0.1,
            color: paletteColor(DETAIL_COLORS, hash(x, y, 8)),
          });
        }
      }
    }

    const gridPositions = Array.from({ length: width + 1 + height + 1 }, (_, i) => i);
    return { grass, water, workshops, details, centers, gridPositions };
  }, [width, height]);

  useEffect(() => {
    writeInstances(grassRef.current, grass, 0);
    writeInstances(waterRef.current, water, 0.01);
    writeInstances(workshopRef.current, workshops, 0.02);
  }, [grass, water, workshops]);

  useEffect(() => {
    if (!detailRef.current) return;
    details.forEach((detail, i) => {
      MATRIX.makeScale(detail.size, detail.size, 1);
      MATRIX.setPosition(detail.x, detail.y, 0.04);
      detailRef.current?.setMatrixAt(i, MATRIX);
      detailRef.current?.setColorAt(i, COLOR.set(detail.color));
    });
    detailRef.current.instanceMatrix.needsUpdate = true;
    if (detailRef.current.instanceColor) detailRef.current.instanceColor.needsUpdate = true;
  }, [details]);

  useEffect(() => {
    if (!glowRef.current) return;
    centers.forEach((center, i) => {
      MATRIX.makeScale(1.9, 1.9, 1);
      MATRIX.setPosition(center.x + 0.5, center.y + 0.5, 0.06);
      glowRef.current?.setMatrixAt(i, MATRIX);
      glowRef.current?.setColorAt(i, COLOR.set("#FFD166"));
    });
    glowRef.current.instanceMatrix.needsUpdate = true;
    if (glowRef.current.instanceColor) glowRef.current.instanceColor.needsUpdate = true;
  }, [centers]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (waterMaterialRef.current) {
      const shimmer = 0.62 + Math.sin(t * 1.6) * 0.12;
      waterMaterialRef.current.color.setHSL(0.56, 0.88, shimmer * 0.12);
      waterMaterialRef.current.opacity = 0.82 + Math.sin(t * 2.1) * 0.08;
    }
    if (glowMaterialRef.current && glowRef.current) {
      const pulse = 0.55 + Math.sin(t * 2.4) * 0.18;
      glowMaterialRef.current.opacity = pulse;
      centers.forEach((center, i) => {
        const scale = 1.88 + Math.sin(t * 2.4 + i * 0.55) * 0.08;
        MATRIX.makeScale(scale, scale, 1);
        MATRIX.setPosition(center.x + 0.5, center.y + 0.5, 0.06);
        glowRef.current?.setMatrixAt(i, MATRIX);
      });
      glowRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh ref={grassRef} args={[undefined, undefined, grass.length]}>
        <planeGeometry args={[0.98, 0.98]} />
        <meshBasicMaterial vertexColors />
      </instancedMesh>

      <instancedMesh ref={waterRef} args={[undefined, undefined, water.length]}>
        <planeGeometry args={[0.98, 0.98]} />
        <meshBasicMaterial ref={waterMaterialRef} vertexColors transparent opacity={0.9} />
      </instancedMesh>

      <instancedMesh ref={workshopRef} args={[undefined, undefined, workshops.length]}>
        <planeGeometry args={[0.98, 0.98]} />
        <meshBasicMaterial vertexColors />
      </instancedMesh>

      <instancedMesh ref={glowRef} args={[undefined, undefined, centers.length]}>
        <ringGeometry args={[0.78, 1.52, 48]} />
        <meshBasicMaterial
          ref={glowMaterialRef}
          vertexColors
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>

      <instancedMesh ref={detailRef} args={[undefined, undefined, details.length]}>
        <circleGeometry args={[1, 10]} />
        <meshBasicMaterial vertexColors />
      </instancedMesh>

      <lineSegments position={[0, 0, 0.07]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={gridPositions.length * 2}
            array={
              new Float32Array(
                gridPositions.flatMap((_, i) => {
                  if (i <= width) return [i, 0, 0, i, height, 0];
                  const y = i - width - 1;
                  return [0, y, 0, width, y, 0];
                }),
              )
            }
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={GRID_COLOR} transparent opacity={0.03} />
      </lineSegments>
    </group>
  );
}
