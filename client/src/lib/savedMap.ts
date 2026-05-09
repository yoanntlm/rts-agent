import { TILE_KINDS, type TileKind } from "./tiles";

// Row-major saved tilemap. Bumped versions get a migration switch.
export type SavedMap = {
  version: 1;
  width: number;
  height: number;
  tiles: TileKind[]; // length === width * height
};

export const STORAGE_KEY = "worldbuilder.map.v1";

export function isTileKind(v: unknown): v is TileKind {
  return typeof v === "string" && (TILE_KINDS as string[]).includes(v);
}

export function isSavedMap(v: unknown): v is SavedMap {
  if (!v || typeof v !== "object") return false;
  const m = v as Partial<SavedMap>;
  if (m.version !== 1) return false;
  if (typeof m.width !== "number" || typeof m.height !== "number") return false;
  if (m.width <= 0 || m.height <= 0) return false;
  if (!Array.isArray(m.tiles)) return false;
  if (m.tiles.length !== m.width * m.height) return false;
  return m.tiles.every(isTileKind);
}

export function loadFromStorage(): SavedMap | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isSavedMap(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveToStorage(map: SavedMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage full or disabled — silently ignore; export still works.
  }
}

export function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function downloadJson(map: SavedMap, filename = "tilemap.json"): void {
  const blob = new Blob([JSON.stringify(map, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function readJsonFile(file: File): Promise<SavedMap> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!isSavedMap(parsed)) {
          reject(new Error("Not a valid tilemap JSON"));
          return;
        }
        resolve(parsed);
      } catch (e) {
        reject(e instanceof Error ? e : new Error("Parse error"));
      }
    };
    reader.readAsText(file);
  });
}
