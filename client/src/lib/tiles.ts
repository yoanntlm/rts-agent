import { useEffect, useState } from "react";
import * as THREE from "three";

// Single source of truth for tile kinds, asset paths, fallback colors, and the
// texture-loading hook. Imported by both the in-game Tilemap and the editor.
//
// Theme: modern tropical Singapore city base layer. Pixel-art technique, but
// the subject vocabulary is real — HDB parks, hawker tile, zebra crossings,
// Marina Bay water — not medieval/fantasy.

export const TILE_PATHS = {
  // Park / nature
  parkGrass: "/assets/generated/park-grass.png",
  parkGrassOrchid: "/assets/generated/park-grass-orchid.png",
  parkGrassHibiscus: "/assets/generated/park-grass-hibiscus.png",
  parkGrassRooster: "/assets/generated/park-grass-rooster.png",
  parkGrassMynah: "/assets/generated/park-grass-mynah.png",
  parkGrassMango: "/assets/generated/park-grass-mango.png",
  tropicalFoliage: "/assets/generated/tropical-foliage.png",
  lalangGrass: "/assets/generated/lalang-grass.png",
  // Walkways
  paverBeige: "/assets/generated/paver-beige.png",
  paverRedBrick: "/assets/generated/paver-red-brick.png",
  voidDeckTile: "/assets/generated/void-deck-tile.png",
  // Streets
  roadAsphalt: "/assets/generated/road-asphalt.png",
  roadCenterLine: "/assets/generated/road-center-line.png",
  roadZebra: "/assets/generated/road-zebra.png",
  roadBusLane: "/assets/generated/road-bus-lane.png",
  // Civic floor
  hawkerTile: "/assets/generated/hawker-tile.png",
  kopitiamTile: "/assets/generated/kopitiam-tile.png",
  // Water
  marinaWater: "/assets/generated/marina-water.png",
  monsoonDrain: "/assets/generated/monsoon-drain.png",
} as const;

export type TileKind = keyof typeof TILE_PATHS;

// Order here drives the editor palette layout — keep grouped by category.
export const TILE_KINDS: TileKind[] = [
  "parkGrass",
  "parkGrassOrchid",
  "parkGrassHibiscus",
  "parkGrassRooster",
  "parkGrassMynah",
  "parkGrassMango",
  "tropicalFoliage",
  "lalangGrass",
  "paverBeige",
  "paverRedBrick",
  "voidDeckTile",
  "roadAsphalt",
  "roadCenterLine",
  "roadZebra",
  "roadBusLane",
  "hawkerTile",
  "kopitiamTile",
  "marinaWater",
  "monsoonDrain",
];

export const TILE_LABEL: Record<TileKind, string> = {
  parkGrass: "Park grass",
  parkGrassOrchid: "Grass · Orchid",
  parkGrassHibiscus: "Grass · Hibiscus",
  parkGrassRooster: "Grass · Rooster",
  parkGrassMynah: "Grass · Mynah",
  parkGrassMango: "Grass · Mango",
  tropicalFoliage: "Tropical foliage",
  lalangGrass: "Lalang grass",
  paverBeige: "Paver · Beige",
  paverRedBrick: "Paver · Red brick",
  voidDeckTile: "Void deck",
  roadAsphalt: "Road",
  roadCenterLine: "Road · Center line",
  roadZebra: "Road · Zebra crossing",
  roadBusLane: "Road · Bus lane",
  hawkerTile: "Hawker tile",
  kopitiamTile: "Kopitiam tile",
  marinaWater: "Marina water",
  monsoonDrain: "Monsoon drain",
};

// Close-to-the-prompt-palette swatches used while PNGs aren't on disk yet, so
// the world stays legible during dev.
export const FALLBACK_COLOR: Record<TileKind, string> = {
  parkGrass: "#58a13a",
  parkGrassOrchid: "#5fa83f",
  parkGrassHibiscus: "#62a83f",
  parkGrassRooster: "#58a13a",
  parkGrassMynah: "#58a13a",
  parkGrassMango: "#6aa83f",
  tropicalFoliage: "#2c5b1e",
  lalangGrass: "#a5b85a",
  paverBeige: "#c8b89a",
  paverRedBrick: "#b04a2a",
  voidDeckTile: "#c89a78",
  roadAsphalt: "#4a4a44",
  roadCenterLine: "#4a4a44",
  roadZebra: "#5a5a52",
  roadBusLane: "#8a3520",
  hawkerTile: "#d8c8a8",
  kopitiamTile: "#a8c898",
  marinaWater: "#4ec5c0",
  monsoonDrain: "#786a58",
};

// Stable hash so a tile's grass variant doesn't reshuffle on every render.
// 70% plain, 14% orchid, 13% hibiscus, 1% rooster, 1% mynah, 1% mango.
function pickGrass(x: number, y: number): TileKind {
  const h = (x * 73856093) ^ (y * 19349663);
  const r = ((h >>> 0) % 100) | 0;
  if (r < 70) return "parkGrass";
  if (r < 84) return "parkGrassOrchid";
  if (r < 97) return "parkGrassHibiscus";
  if (r === 97) return "parkGrassRooster";
  if (r === 98) return "parkGrassMynah";
  return "parkGrassMango";
}

// Default fill: grass everywhere with a 3x3 hawker pad in the middle and a
// paver-beige sidewalk leading south to the bottom edge. The user paints
// roads, water, and shophouse pavers themselves in the editor.
export function proceduralTile(
  x: number,
  y: number,
  width: number,
  height: number,
): TileKind {
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  if (Math.abs(x - cx) <= 1 && Math.abs(y - cy) <= 1) return "hawkerTile";
  if (x === cx && y < cy - 1 && y >= 1) return "paverBeige";
  return pickGrass(x, y);
}

export function buildProceduralTiles(width: number, height: number): TileKind[] {
  const out = new Array<TileKind>(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      out[y * width + x] = proceduralTile(x, y, width, height);
    }
  }
  return out;
}

// Imperative texture load. Missing PNGs leave the entry undefined so callers
// can fall back to FALLBACK_COLOR while assets bake.
export function useTileTextures(): Partial<Record<TileKind, THREE.Texture>> {
  const [textures, setTextures] = useState<Partial<Record<TileKind, THREE.Texture>>>(
    {},
  );

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    let cancelled = false;
    const next: Partial<Record<TileKind, THREE.Texture>> = {};
    const entries = Object.entries(TILE_PATHS) as [TileKind, string][];

    Promise.all(
      entries.map(
        ([key, path]) =>
          new Promise<void>((resolve) => {
            loader.load(
              path,
              (tex) => {
                tex.magFilter = THREE.NearestFilter;
                tex.minFilter = THREE.NearestFilter;
                tex.generateMipmaps = false;
                tex.colorSpace = THREE.SRGBColorSpace;
                tex.wrapS = THREE.RepeatWrapping;
                tex.wrapT = THREE.RepeatWrapping;
                tex.needsUpdate = true;
                next[key] = tex;
                resolve();
              },
              undefined,
              () => resolve(),
            );
          }),
      ),
    ).then(() => {
      if (!cancelled) setTextures(next);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return textures;
}
