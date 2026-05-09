import { useCallback, useEffect, useMemo, useState } from "react";
import { TILE_KINDS, TILE_LABEL, type TileKind } from "../../lib/tiles";

// ---------- Types ------------------------------------------------------------

type Size = "1024x1024" | "1024x1536" | "1536x1024" | "auto";
type Quality = "low" | "medium" | "high" | "auto";
type Background = "opaque" | "transparent" | "auto";

type GenerateParams = {
  prompt: string;
  size: Size;
  quality: Quality;
  n: number;
  background: Background;
  model: string;
};

type LibraryEntry = {
  filename: string;
  url: string;
  prompt: string;
  params: Record<string, unknown>;
  savedAt: string;
};

// ---------- Component --------------------------------------------------------

const DEFAULTS: GenerateParams = {
  prompt: "",
  size: "1024x1024",
  quality: "high",
  n: 1,
  background: "opaque",
  model: "gpt-image-2",
};

export default function Playground() {
  const [params, setParams] = useState<GenerateParams>(DEFAULTS);
  const [refs, setRefs] = useState<{ key: string; b64: string; label: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ b64: string }[]>([]);
  const [library, setLibrary] = useState<LibraryEntry[]>([]);

  const refreshLibrary = useCallback(async () => {
    try {
      const r = await fetch("/api/img/library");
      const j = (await r.json()) as { entries: LibraryEntry[] };
      setLibrary(j.entries);
    } catch (err) {
      console.error("library fetch failed", err);
    }
  }, []);

  useEffect(() => {
    void refreshLibrary();
  }, [refreshLibrary]);

  const update = useCallback(<K extends keyof GenerateParams>(k: K, v: GenerateParams[K]) => {
    setParams((p) => ({ ...p, [k]: v }));
  }, []);

  const onPickRefs = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const out: { key: string; b64: string; label: string }[] = [];
    for (const f of Array.from(files).slice(0, 4)) {
      const b64 = await fileToBase64(f);
      out.push({ key: `${Date.now()}-${f.name}`, b64, label: f.name });
    }
    setRefs((prev) => [...prev, ...out].slice(0, 4));
  }, []);

  const addRefFromLibrary = useCallback(async (entry: LibraryEntry) => {
    try {
      const r = await fetch(entry.url);
      const blob = await r.blob();
      const b64 = await blobToBase64(blob);
      setRefs((prev) =>
        [...prev, { key: `lib-${entry.filename}`, b64, label: entry.filename }].slice(0, 4),
      );
    } catch (err) {
      console.error("failed to add ref from library", err);
    }
  }, []);

  const removeRef = useCallback((key: string) => {
    setRefs((prev) => prev.filter((r) => r.key !== key));
  }, []);

  const onGenerate = useCallback(async () => {
    if (!params.prompt.trim()) {
      setError("Enter a prompt first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/img/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...params,
          refImages: refs.map((r) => r.b64),
        }),
      });
      const j = (await r.json()) as { images?: string[]; error?: string };
      if (!r.ok || j.error) {
        setError(j.error ?? `HTTP ${r.status}`);
        setResults([]);
      } else {
        setResults((j.images ?? []).map((b64) => ({ b64 })));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [params, refs]);

  const onSave = useCallback(
    async (b64: string, name: string) => {
      try {
        const r = await fetch("/api/img/save", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name,
            b64,
            prompt: params.prompt,
            params: { ...params, refCount: refs.length },
          }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          setError(`save failed: ${(j as { error?: string }).error ?? r.status}`);
          return;
        }
        await refreshLibrary();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [params, refs, refreshLibrary],
  );

  const onPromote = useCallback(
    async (libraryFilename: string, tileKey: TileKind) => {
      try {
        const r = await fetch("/api/img/promote", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ libraryFilename, tileKey }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          setError(`promote failed: ${(j as { error?: string }).error ?? r.status}`);
          return;
        }
        const okBody = (await r.json()) as { ok?: boolean; dst?: string };
        setError(null);
        alert(
          `Promoted to ${okBody.dst ?? "/assets/generated/…"} — hard-reload the game (⌘⇧R) so Three.js reloads textures.`,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [],
  );

  const promptSlug = useMemo(
    () => params.prompt.split(/\s+/).slice(0, 6).join("-").slice(0, 40),
    [params.prompt],
  );

  return (
    <div className="min-h-screen w-screen bg-stone-950 text-stone-100">
      <header className="flex items-center justify-between border-b border-stone-800 bg-stone-900 px-6 py-3">
        <h1 className="text-sm font-semibold tracking-wide text-amber-300">
          Playground · gpt-image
        </h1>
        <div className="flex gap-2 text-xs">
          <a href="/" className="rounded border border-stone-700 px-2 py-1 hover:border-stone-500">
            ← Game
          </a>
          <a
            href="/editor"
            className="rounded border border-stone-700 px-2 py-1 hover:border-stone-500"
          >
            Editor
          </a>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
        {/* Prompt + params */}
        <section className="rounded-lg border border-stone-800 bg-stone-900 p-4">
          <label className="block text-[10px] uppercase tracking-wider text-stone-400">
            Prompt
          </label>
          <textarea
            value={params.prompt}
            onChange={(e) => update("prompt", e.target.value)}
            rows={5}
            placeholder="Top-down pixel-art tile of a Singapore HDB park sidewalk…"
            className="mt-1 w-full resize-y rounded border border-stone-700 bg-stone-950 p-2 font-mono text-xs leading-relaxed outline-none focus:border-amber-500"
          />

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Select
              label="Model"
              value={params.model}
              onChange={(v) => update("model", v)}
              options={["gpt-image-2", "gpt-image-1"]}
            />
            <Select
              label="Size"
              value={params.size}
              onChange={(v) => update("size", v as Size)}
              options={["1024x1024", "1024x1536", "1536x1024", "auto"]}
            />
            <Select
              label="Quality"
              value={params.quality}
              onChange={(v) => update("quality", v as Quality)}
              options={["low", "medium", "high", "auto"]}
            />
            <Select
              label="Background"
              value={params.background}
              onChange={(v) => update("background", v as Background)}
              options={["opaque", "transparent", "auto"]}
            />
            <NumField
              label="N"
              value={params.n}
              min={1}
              max={4}
              onChange={(v) => update("n", v)}
            />
          </div>

          {/* References */}
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] uppercase tracking-wider text-stone-400">
                Reference images <span className="text-stone-500">(optional, up to 4)</span>
              </label>
              <label className="cursor-pointer rounded border border-stone-700 bg-stone-800 px-2 py-1 text-xs hover:border-stone-500">
                Add files
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => onPickRefs(e.target.files)}
                />
              </label>
            </div>
            {refs.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {refs.map((r) => (
                  <div
                    key={r.key}
                    className="relative h-16 w-16 overflow-hidden rounded border border-stone-700"
                    title={r.label}
                  >
                    <img
                      src={`data:image/png;base64,${r.b64}`}
                      alt={r.label}
                      className="h-full w-full object-cover"
                      style={{ imageRendering: "pixelated" }}
                    />
                    <button
                      type="button"
                      onClick={() => removeRef(r.key)}
                      className="absolute right-0 top-0 rounded-bl bg-stone-900/80 px-1 text-[10px] hover:bg-red-500/40"
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-stone-500">
                Add images from your machine, or click <em>“+ ref”</em> on a library entry below
                to pin it as a style anchor for the next generation.
              </p>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={onGenerate}
              disabled={busy || !params.prompt.trim()}
              className="rounded border border-amber-500/60 bg-amber-500/15 px-4 py-1.5 text-sm font-semibold text-amber-200 hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Generating…" : refs.length > 0 ? "Generate (with refs)" : "Generate"}
            </button>
            {error && <span className="text-xs text-red-400">{error}</span>}
          </div>
        </section>

        {/* Latest results */}
        {results.length > 0 && (
          <section className="rounded-lg border border-stone-800 bg-stone-900 p-4">
            <h2 className="mb-3 text-[10px] uppercase tracking-wider text-stone-400">
              Latest result{results.length > 1 ? "s" : ""}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {results.map((r, i) => (
                <ResultCard
                  key={i}
                  b64={r.b64}
                  name={`${promptSlug}-${i + 1}`}
                  onSave={() => onSave(r.b64, `${promptSlug}-${i + 1}`)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Library */}
        <section className="rounded-lg border border-stone-800 bg-stone-900 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[10px] uppercase tracking-wider text-stone-400">
              Library <span className="text-stone-500">({library.length})</span>
            </h2>
            <button
              type="button"
              onClick={refreshLibrary}
              className="rounded border border-stone-700 px-2 py-0.5 text-[11px] hover:border-stone-500"
            >
              Refresh
            </button>
          </div>
          <p className="mb-3 rounded border border-stone-800 bg-stone-950/80 p-2 text-[11px] leading-relaxed text-stone-500">
            <span className="font-semibold text-stone-400">Use tiles in the game:</span> (1) Save a result here → file goes to{" "}
            <code className="text-stone-400">public/assets/playground/</code>. (2) Pick a slot (e.g. Park grass) →{" "}
            <span className="text-amber-200/90">→ tile</span> copies it to{" "}
            <code className="text-stone-400">public/assets/generated/</code> — that overwrites the PNG for that tile type. (3) Hard refresh the game tab (
            <kbd className="rounded bg-stone-800 px-1">⌘⇧R</kbd> / cache-bypass reload) so textures reload.
          </p>
          {library.length === 0 ? (
            <p className="text-[11px] text-stone-500">
              Nothing saved yet. Generate something and click <em>Save</em>.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {library.map((e) => (
                <LibraryCard
                  key={e.filename}
                  entry={e}
                  onAddRef={() => addRefFromLibrary(e)}
                  onPromote={(tileKey) => onPromote(e.filename, tileKey)}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

// ---------- Subcomponents ----------------------------------------------------

function Select<T extends string>(props: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: T[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-stone-400">{props.label}</span>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value as T)}
        className="rounded border border-stone-700 bg-stone-950 px-2 py-1 text-xs outline-none focus:border-amber-500"
      >
        {props.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumField(props: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-stone-400">{props.label}</span>
      <input
        type="number"
        value={props.value}
        min={props.min}
        max={props.max}
        onChange={(e) => {
          const v = Number.parseInt(e.target.value, 10);
          if (Number.isFinite(v)) props.onChange(v);
        }}
        className="rounded border border-stone-700 bg-stone-950 px-2 py-1 text-xs outline-none focus:border-amber-500"
      />
    </label>
  );
}

function ResultCard(props: { b64: string; name: string; onSave: () => void }) {
  return (
    <div className="rounded border border-stone-700 bg-stone-950 p-2">
      <div className="aspect-square w-full overflow-hidden rounded bg-stone-800">
        <img
          src={`data:image/png;base64,${props.b64}`}
          alt=""
          className="h-full w-full object-contain"
          style={{ imageRendering: "pixelated" }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="truncate text-[11px] text-stone-400">{props.name}</span>
        <button
          type="button"
          onClick={props.onSave}
          className="rounded border border-stone-700 px-2 py-0.5 text-[11px] hover:border-amber-500"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function LibraryCard(props: {
  entry: LibraryEntry;
  onAddRef: () => void;
  onPromote: (tileKey: TileKind) => void;
}) {
  const [tileKey, setTileKey] = useState<TileKind>(TILE_KINDS[0]!);
  return (
    <div className="rounded border border-stone-700 bg-stone-950 p-2">
      <div className="aspect-square w-full overflow-hidden rounded bg-stone-800">
        <img
          src={props.entry.url}
          alt={props.entry.filename}
          className="h-full w-full object-contain"
          style={{ imageRendering: "pixelated" }}
        />
      </div>
      <div className="mt-2 truncate text-[11px] text-stone-300" title={props.entry.prompt}>
        {props.entry.prompt.split("\n").slice(-1)[0]?.trim() || props.entry.filename}
      </div>
      <div className="mt-2 flex items-center gap-1">
        <button
          type="button"
          onClick={props.onAddRef}
          className="flex-1 rounded border border-stone-700 px-1 py-0.5 text-[11px] hover:border-amber-500"
          title="Use this image as a reference for the next generation"
        >
          + ref
        </button>
        <select
          value={tileKey}
          onChange={(e) => setTileKey(e.target.value as TileKind)}
          className="flex-1 rounded border border-stone-700 bg-stone-950 px-1 py-0.5 text-[11px] outline-none focus:border-amber-500"
        >
          {TILE_KINDS.map((k) => (
            <option key={k} value={k}>
              {TILE_LABEL[k]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => props.onPromote(tileKey)}
          className="rounded border border-amber-500/60 bg-amber-500/15 px-1.5 py-0.5 text-[11px] text-amber-200 hover:bg-amber-500/25"
          title="Copy this image into /assets/generated/<tile>.png"
        >
          → tile
        </button>
      </div>
    </div>
  );
}

// ---------- Helpers ----------------------------------------------------------

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}
