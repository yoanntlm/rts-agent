import { useEffect, useMemo, useState } from "react";
import { TILE_PATHS, type TileKind } from "../../lib/tiles";
import { BUNDLED_TILEMAP_URL, type SavedMap } from "../../lib/savedMap";

const MAX_SELECTION = 10;
const TILE_PX = 22;

type Pos = { x: number; y: number };

export default function Anchors() {
  const [map, setMap] = useState<SavedMap | null>(null);
  const [selected, setSelected] = useState<Pos[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(BUNDLED_TILEMAP_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: SavedMap) => {
        if (!cancelled) setMap(data);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const json = useMemo(
    () =>
      "[\n" +
      selected.map((p) => `  { x: ${p.x}, y: ${p.y} },`).join("\n") +
      (selected.length > 0 ? "\n" : "") +
      "]",
    [selected],
  );

  if (error) {
    return (
      <div className="p-8 text-sm text-red-700">
        Failed to load tilemap: {error}
      </div>
    );
  }
  if (!map) {
    return <div className="p-8 text-sm text-ink-soft">Loading tilemap…</div>;
  }

  const toggle = (x: number, y: number) => {
    setSelected((prev) => {
      const idx = prev.findIndex((p) => p.x === x && p.y === y);
      if (idx >= 0) return prev.filter((_, i) => i !== idx);
      if (prev.length >= MAX_SELECTION) return prev;
      return [...prev, { x, y }];
    });
  };

  const copyJson = () => {
    void navigator.clipboard.writeText(json);
  };

  return (
    <div className="flex min-h-screen flex-col items-center gap-4 bg-cream p-6 text-ink">
      <header className="flex w-full max-w-5xl items-center justify-between">
        <h1 className="text-lg font-semibold">
          Pick {MAX_SELECTION} workshop anchors
        </h1>
        <div className="text-sm text-ink-muted">
          {selected.length}/{MAX_SELECTION} selected
        </div>
      </header>

      <p className="max-w-5xl text-xs text-ink-soft">
        Click a tile to add it; click again to remove. Each anchor is the center
        of a 3×3 construction-site footprint, so leave at least 1 tile around
        the edges and ~3 tiles between anchors. Once you have 10, copy the
        array and paste it back to me.
      </p>

      <div
        className="grid select-none border border-line-strong bg-ink/10"
        style={{
          gridTemplateColumns: `repeat(${map.width}, ${TILE_PX}px)`,
          width: map.width * TILE_PX,
        }}
      >
        {Array.from({ length: map.width * map.height }, (_, i) => {
          const x = i % map.width;
          const y = Math.floor(i / map.width);
          const kind = map.tiles[i] as TileKind;
          const sel = selected.findIndex((p) => p.x === x && p.y === y);
          const isSelected = sel >= 0;
          return (
            <button
              key={i}
              type="button"
              onClick={() => toggle(x, y)}
              title={`(${x}, ${y}) · ${kind}`}
              className="relative cursor-pointer border border-black/5 transition hover:brightness-110"
              style={{
                width: TILE_PX,
                height: TILE_PX,
                backgroundImage: `url(${TILE_PATHS[kind]})`,
                backgroundSize: "cover",
                imageRendering: "pixelated",
              }}
            >
              {isSelected && (
                <span
                  className="absolute inset-0 flex items-center justify-center bg-cyan-500/55 font-mono text-[10px] font-bold text-white"
                  style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}
                >
                  {sel + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex w-full max-w-5xl flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-ink-soft">
            Output (TS array)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelected([])}
              className="rounded border border-line bg-paper px-2 py-1 text-xs hover:bg-paper-hover"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={copyJson}
              className="rounded border border-cyan-700/40 bg-cyan-100 px-2 py-1 text-xs font-semibold text-cyan-900 hover:bg-cyan-200"
            >
              Copy
            </button>
          </div>
        </div>
        <textarea
          readOnly
          value={json}
          className="h-48 w-full rounded border border-line bg-paper p-3 font-mono text-xs"
        />
      </div>
    </div>
  );
}
