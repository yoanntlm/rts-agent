import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

// ---------- Types ------------------------------------------------------------
//
// Mirrors the shape written by `assets-gen/src/animate-building.ts`. Kept
// inline so the component has no compile-time coupling to assets-gen — the
// meta is fetched at runtime.

export type AnimationMeta = {
  name: string;
  source: string;
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  sheetWidth: number;
  sheetHeight: number;
  suggestedFps: number;
  loop: boolean;
  createdAt: string;
};

type Props = {
  /** Folder name under /assets/buildings/animations/ (e.g. "construction-zone-3x3"). */
  name: string;
  /** Override `meta.suggestedFps`. Ignored when `controlledFrame` is set. */
  fps?: number;
  /** Pause the auto-loop. Ignored when `controlledFrame` is set. */
  paused?: boolean;
  /** When set, displays this exact frame index (0-based) and disables the auto-loop. */
  controlledFrame?: number;
  /** Notified whenever the auto-loop advances. Useful for an external scrubber. */
  onFrameChange?: (index: number) => void;
  /** Notified once metadata is loaded — gives the parent access to fps, frameCount, etc. */
  onMetaLoaded?: (meta: AnimationMeta) => void;
  className?: string;
  style?: CSSProperties;
};

/**
 * Loops the per-frame PNGs at /assets/buildings/animations/<name>/frame-NN.png,
 * driven by /assets/buildings/animations/<name>/meta.json.
 *
 * Frames are preloaded eagerly on mount so the first cycle doesn't flicker.
 * Pixel-art rendering (NearestFilter equivalent) is forced via CSS.
 */
export default function AnimatedBuilding({
  name,
  fps,
  paused,
  controlledFrame,
  onFrameChange,
  onMetaLoaded,
  className,
  style,
}: Props) {
  const [meta, setMeta] = useState<AnimationMeta | null>(null);
  const [frame, setFrame] = useState(0);
  const [ready, setReady] = useState(false);

  // Stable ref to the latest onFrameChange so we don't re-create the interval
  // every time the parent re-renders.
  const onFrameChangeRef = useRef(onFrameChange);
  useEffect(() => {
    onFrameChangeRef.current = onFrameChange;
  }, [onFrameChange]);

  // ---- Load meta + preload all frames ----
  useEffect(() => {
    let cancelled = false;
    setMeta(null);
    setReady(false);
    setFrame(0);

    (async () => {
      try {
        const r = await fetch(`/assets/buildings/animations/${name}/meta.json`);
        if (!r.ok) throw new Error(`meta.json fetch failed: ${r.status}`);
        const m = (await r.json()) as AnimationMeta;
        if (cancelled) return;
        setMeta(m);
        onMetaLoaded?.(m);

        const urls = Array.from({ length: m.frameCount }, (_, i) => frameUrl(name, i));
        await Promise.all(urls.map(preload));
        if (!cancelled) setReady(true);
      } catch (err) {
        console.error(`[AnimatedBuilding:${name}]`, err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [name, onMetaLoaded]);

  // ---- Auto-loop ----
  useEffect(() => {
    if (!meta || !ready || paused) return;
    if (controlledFrame !== undefined) return;
    const fpsValue = fps ?? meta.suggestedFps;
    const intervalMs = Math.max(33, Math.round(1000 / fpsValue));
    const handle = window.setInterval(() => {
      setFrame((f) => {
        const next = (f + 1) % meta.frameCount;
        onFrameChangeRef.current?.(next);
        return next;
      });
    }, intervalMs);
    return () => window.clearInterval(handle);
  }, [meta, ready, paused, fps, controlledFrame]);

  // ---- Pick frame to render ----
  const renderedFrame =
    controlledFrame !== undefined && meta
      ? Math.max(0, Math.min(controlledFrame, meta.frameCount - 1))
      : frame;

  if (!meta) {
    return (
      <div
        className={className}
        style={{
          display: "grid",
          placeItems: "center",
          aspectRatio: "1 / 1",
          ...style,
        }}
      >
        <span className="text-xs text-stone-500">Loading {name}…</span>
      </div>
    );
  }

  return (
    <img
      src={frameUrl(name, renderedFrame)}
      alt={`${name} frame ${renderedFrame + 1}/${meta.frameCount}`}
      className={className}
      style={{
        imageRendering: "pixelated",
        userSelect: "none",
        ...style,
      }}
      draggable={false}
    />
  );
}

// ---------- Helpers ----------------------------------------------------------

function frameUrl(name: string, index: number): string {
  const padded = String(index + 1).padStart(2, "0");
  return `/assets/buildings/animations/${name}/frame-${padded}.png`;
}

function preload(src: string): Promise<void> {
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve(); // fail silently — the visible <img> will retry
    img.src = src;
  });
}
