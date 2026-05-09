import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildProceduralTiles,
  TILE_KINDS,
  TILE_LABEL,
  type TileKind,
} from "../../lib/tiles";
import {
  downloadJson,
  loadFromStorage,
  readJsonFile,
  saveToStorage,
  type SavedMap,
} from "../../lib/savedMap";
import EditorCanvas from "./EditorCanvas";
import TilePalette from "./TilePalette";

const DEFAULT_W = 16;
const DEFAULT_H = 16;
const MIN_DIM = 4;
const MAX_DIM = 64;

export default function Editor() {
  const [width, setWidth] = useState(DEFAULT_W);
  const [height, setHeight] = useState(DEFAULT_H);
  const [tiles, setTiles] = useState<TileKind[]>(() => buildProceduralTiles(DEFAULT_W, DEFAULT_H));
  const [selected, setSelected] = useState<TileKind>("parkGrass");
  const [status, setStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load saved map on first mount, if one exists.
  useEffect(() => {
    const saved = loadFromStorage();
    if (saved) {
      setWidth(saved.width);
      setHeight(saved.height);
      setTiles(saved.tiles);
      setStatus(`Loaded ${saved.width}×${saved.height} from local storage`);
    }
  }, []);

  // Auto-save on every tile change. Debounced via rAF to coalesce drag spam.
  const pendingSave = useRef<number | null>(null);
  useEffect(() => {
    if (pendingSave.current != null) cancelAnimationFrame(pendingSave.current);
    pendingSave.current = requestAnimationFrame(() => {
      const map: SavedMap = { version: 1, width, height, tiles };
      saveToStorage(map);
    });
    return () => {
      if (pendingSave.current != null) cancelAnimationFrame(pendingSave.current);
    };
  }, [width, height, tiles]);

  const paint = useCallback(
    (x: number, y: number) => {
      setTiles((prev) => {
        const i = y * width + x;
        if (prev[i] === selected) return prev;
        const next = prev.slice();
        next[i] = selected;
        return next;
      });
    },
    [selected, width],
  );

  const resize = useCallback((newW: number, newH: number) => {
    const w = clamp(newW, MIN_DIM, MAX_DIM);
    const h = clamp(newH, MIN_DIM, MAX_DIM);
    setTiles((prev) => {
      // Preserve overlap when resizing; fill new cells with parkGrass.
      const next = new Array<TileKind>(w * h).fill("parkGrass");
      for (let y = 0; y < Math.min(h, height); y++) {
        for (let x = 0; x < Math.min(w, width); x++) {
          next[y * w + x] = prev[y * width + x] ?? "parkGrass";
        }
      }
      return next;
    });
    setWidth(w);
    setHeight(h);
  }, [width, height]);

  const fillAll = useCallback(() => {
    setTiles(new Array(width * height).fill(selected));
  }, [width, height, selected]);

  const reseed = useCallback(() => {
    setTiles(buildProceduralTiles(width, height));
  }, [width, height]);

  const onExport = useCallback(() => {
    const map: SavedMap = { version: 1, width, height, tiles };
    downloadJson(map, `tilemap-${width}x${height}.json`);
    setStatus("Exported tilemap.json");
  }, [width, height, tiles]);

  const onImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same filename later
    if (!file) return;
    try {
      const map = await readJsonFile(file);
      setWidth(map.width);
      setHeight(map.height);
      setTiles(map.tiles);
      setStatus(`Imported ${map.width}×${map.height}`);
    } catch (err) {
      setStatus(`Import failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }, []);

  // Keyboard shortcuts: number keys 1-6 cycle through palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const idx = Number.parseInt(e.key, 10) - 1;
      const kind = TILE_KINDS[idx];
      if (kind) setSelected(kind);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-stone-950 text-stone-100">
      <aside className="flex w-64 shrink-0 flex-col gap-4 overflow-y-auto border-r border-stone-800 bg-stone-900 p-4">
        <header className="flex items-center justify-between">
          <h1 className="text-sm font-semibold tracking-wide text-amber-300">
            Worldbuilder
          </h1>
          <a
            href="/"
            className="rounded border border-stone-700 px-2 py-1 text-xs text-stone-300 hover:border-stone-500"
          >
            ← Game
          </a>
        </header>

        <section>
          <h2 className="mb-2 text-[10px] uppercase tracking-wider text-stone-400">
            Palette <span className="text-stone-500">(1–9)</span>
          </h2>
          <TilePalette selected={selected} onSelect={setSelected} />
          <p className="mt-2 text-[11px] text-stone-400">
            Painting with: <span className="text-stone-200">{TILE_LABEL[selected]}</span>
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-[10px] uppercase tracking-wider text-stone-400">Map size</h2>
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Width"
              value={width}
              min={MIN_DIM}
              max={MAX_DIM}
              onChange={(v) => resize(v, height)}
            />
            <NumberField
              label="Height"
              value={height}
              min={MIN_DIM}
              max={MAX_DIM}
              onChange={(v) => resize(width, v)}
            />
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-[10px] uppercase tracking-wider text-stone-400">Actions</h2>
          <button
            type="button"
            onClick={fillAll}
            className="rounded border border-stone-700 bg-stone-800 px-2 py-1.5 text-xs hover:border-stone-500"
          >
            Fill all with selected
          </button>
          <button
            type="button"
            onClick={reseed}
            className="rounded border border-stone-700 bg-stone-800 px-2 py-1.5 text-xs hover:border-stone-500"
          >
            Reset to procedural
          </button>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-[10px] uppercase tracking-wider text-stone-400">Save / Load</h2>
          <button
            type="button"
            onClick={onExport}
            className="rounded border border-amber-500/60 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-200 hover:bg-amber-500/20"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={onImportClick}
            className="rounded border border-stone-700 bg-stone-800 px-2 py-1.5 text-xs hover:border-stone-500"
          >
            Import JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onImportFile}
          />
          <p className="text-[11px] leading-snug text-stone-500">
            Auto-saves to your browser. Export to share or bake into the game.
          </p>
        </section>

        {status && (
          <div className="rounded bg-stone-800/80 px-2 py-1.5 text-[11px] text-stone-300">
            {status}
          </div>
        )}
      </aside>

      <main className="relative flex-1">
        <EditorCanvas
          width={width}
          height={height}
          tiles={tiles}
          onPaint={paint}
        />
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded bg-stone-900/80 px-3 py-1 text-[11px] text-stone-300">
          Click or drag to paint · {width}×{height} tiles
        </div>
      </main>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px] text-stone-400">
      {label}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const v = Number.parseInt(e.target.value, 10);
          if (!Number.isNaN(v)) onChange(v);
        }}
        className="rounded border border-stone-700 bg-stone-950 px-2 py-1 text-sm text-stone-100 focus:border-amber-400 focus:outline-none"
      />
    </label>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
