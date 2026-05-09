export default function SetupBanner() {
  return (
    <div className="max-w-md rounded-lg border border-amber-700/50 bg-amber-950/80 p-3 text-xs text-amber-100 backdrop-blur">
      <div className="font-semibold text-amber-200">Convex not configured</div>
      <p className="mt-1 leading-relaxed text-amber-100/80">
        The UI is rendering in preview mode. To enable spawning agents and realtime sync, run{" "}
        <code className="rounded bg-amber-950 px-1 py-0.5 text-amber-200">npx convex dev</code> from{" "}
        <code className="rounded bg-amber-950 px-1 py-0.5 text-amber-200">/convex</code>, then copy the
        deployment URL to{" "}
        <code className="rounded bg-amber-950 px-1 py-0.5 text-amber-200">client/.env.local</code> as{" "}
        <code className="rounded bg-amber-950 px-1 py-0.5 text-amber-200">VITE_CONVEX_URL</code>.
      </p>
    </div>
  );
}
