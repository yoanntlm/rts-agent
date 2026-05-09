/**
 * Debug / preview route at `/preview` — construction-building asset sanity check.
 * Run `pnpm assets:animate-building` to emit sprite sheets under
 * `/assets/buildings/animations/` for richer previews later.
 */
export default function Preview() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-stone-950 p-8 text-stone-100">
      <div className="text-center">
        <h1 className="text-lg font-semibold tracking-tight text-stone-100">
          Construction zone preview
        </h1>
        <p className="mt-1 max-w-md text-sm text-stone-500">
          Static 3×3 reference PNG from assets-gen. Use this route to verify textures load before placing them on the tilemap.
        </p>
      </div>
      <div className="rounded-xl border border-amber-200/15 bg-stone-900/80 p-4 shadow-2xl shadow-black/40">
        <img
          src="/assets/buildings/construction-zone-3x3.png"
          alt="Construction zone 3×3 pixel tile"
          className="max-h-[min(70vh,720px)] max-w-full object-contain"
          width={1024}
          height={1024}
          draggable={false}
        />
      </div>
      <p className="text-[11px] text-stone-600">
        Animated strips:{" "}
        <code className="rounded bg-stone-900 px-1 py-0.5 text-stone-400">
          pnpm assets:animate-building
        </code>
      </p>
    </div>
  );
}
