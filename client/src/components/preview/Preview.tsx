import { useState } from "react";
import AnimatedBuilding, { type AnimationMeta } from "../AnimatedBuilding";

// Hard-coded list for now — add more entries as you generate animations via
// `pnpm assets:animate-building`. The folder name under
// /assets/buildings/animations/ must match.
const ANIMATIONS = ["construction-zone-3x3"];

export default function Preview() {
  const [name, setName] = useState<string>(ANIMATIONS[0]!);
  const [meta, setMeta] = useState<AnimationMeta | null>(null);
  const [fps, setFps] = useState<number>(4);
  const [paused, setPaused] = useState<boolean>(false);
  const [scrubFrame, setScrubFrame] = useState<number | null>(null);

  return (
    <div className="min-h-screen w-screen bg-stone-950 text-stone-100">
      <header className="flex items-center justify-between border-b border-stone-800 bg-stone-900 px-6 py-3">
        <h1 className="text-sm font-semibold tracking-wide text-amber-300">
          Preview · animated buildings
        </h1>
        <div className="flex gap-2 text-xs">
          <a href="/" className="rounded border border-stone-700 px-2 py-1 hover:border-stone-500">
            ← Game
          </a>
          <a
            href="/playground"
            className="rounded border border-stone-700 px-2 py-1 hover:border-stone-500"
          >
            Playground
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
        {/* Animation picker */}
        <section className="flex items-center gap-3">
          <label className="text-[10px] uppercase tracking-wider text-stone-400">
            Animation
          </label>
          <select
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setScrubFrame(null);
              setPaused(false);
            }}
            className="rounded border border-stone-700 bg-stone-950 px-2 py-1 text-xs outline-none focus:border-amber-500"
          >
            {ANIMATIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          {meta && (
            <span className="text-[11px] text-stone-500">
              {meta.frameWidth}×{meta.frameHeight} · {meta.frameCount} frames · suggested {meta.suggestedFps} fps
            </span>
          )}
        </section>

        {/* Loop + reference side by side */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card title="Animated loop">
            <div className="aspect-square w-full overflow-hidden rounded bg-stone-800">
              <AnimatedBuilding
                key={name}
                name={name}
                fps={fps}
                paused={paused || scrubFrame !== null}
                controlledFrame={scrubFrame ?? undefined}
                onMetaLoaded={setMeta}
                className="block h-full w-full object-contain"
              />
            </div>

            {/* Controls */}
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPaused((p) => !p);
                    setScrubFrame(null);
                  }}
                  className="rounded border border-amber-500/60 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-500/25"
                >
                  {paused || scrubFrame !== null ? "▶ Play" : "❚❚ Pause"}
                </button>
                {scrubFrame !== null && (
                  <button
                    type="button"
                    onClick={() => setScrubFrame(null)}
                    className="rounded border border-stone-700 px-2 py-1 text-[11px] hover:border-stone-500"
                  >
                    Resume loop
                  </button>
                )}
              </div>

              <label className="flex items-center gap-2 text-[11px] text-stone-400">
                <span className="w-10">FPS</span>
                <input
                  type="range"
                  min={1}
                  max={12}
                  step={1}
                  value={fps}
                  onChange={(e) => setFps(Number.parseInt(e.target.value, 10))}
                  className="flex-1"
                />
                <span className="w-6 text-right tabular-nums text-stone-200">{fps}</span>
              </label>
            </div>
          </Card>

          <Card title="Reference (static source)">
            <div className="aspect-square w-full overflow-hidden rounded bg-stone-800">
              {meta && (
                <img
                  src={`/assets/buildings/${meta.source}`}
                  alt={meta.source}
                  className="block h-full w-full object-contain"
                  style={{ imageRendering: "pixelated" }}
                  draggable={false}
                />
              )}
            </div>
            <p className="mt-2 text-[11px] text-stone-500">
              The base image fed to <code>images.edit</code> as the visual anchor for every frame.
            </p>
          </Card>
        </section>

        {/* Frame thumbnails — click to scrub */}
        {meta && (
          <Card title="Frames (click to scrub)">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {Array.from({ length: meta.frameCount }, (_, i) => i).map((i) => {
                const padded = String(i + 1).padStart(2, "0");
                const url = `/assets/buildings/animations/${name}/frame-${padded}.png`;
                const isActive = scrubFrame === i;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setScrubFrame(i)}
                    className={[
                      "group relative overflow-hidden rounded border bg-stone-950 transition",
                      isActive
                        ? "border-amber-500"
                        : "border-stone-700 hover:border-stone-500",
                    ].join(" ")}
                  >
                    <img
                      src={url}
                      alt={`frame ${padded}`}
                      className="aspect-square w-full object-cover"
                      style={{ imageRendering: "pixelated" }}
                      draggable={false}
                    />
                    <span className="absolute bottom-0 left-0 right-0 bg-stone-950/80 py-0.5 text-center text-[10px] text-stone-300">
                      {padded}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {/* Sprite sheet — horizontal scroll */}
        {meta && (
          <Card title={`Sprite sheet (${meta.sheetWidth}×${meta.sheetHeight})`}>
            <div className="overflow-x-auto rounded bg-stone-800">
              <img
                src={`/assets/buildings/animations/${name}/sheet.png`}
                alt={`${name} sheet`}
                className="block h-32 w-auto"
                style={{ imageRendering: "pixelated" }}
                draggable={false}
              />
            </div>
            <p className="mt-2 text-[11px] text-stone-500">
              Frames laid out horizontally, left-to-right. This is the artifact a sprite-aware
              renderer (e.g. Three.js with sub-UV sampling, or CSS{" "}
              <code>background-position</code> + <code>steps()</code>) would consume in production.
            </p>
          </Card>
        )}
      </main>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-stone-800 bg-stone-900 p-4">
      <h2 className="mb-3 text-[10px] uppercase tracking-wider text-stone-400">{title}</h2>
      {children}
    </section>
  );
}
