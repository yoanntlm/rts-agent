import type { ReactNode } from "react";

type Props = {
  topBar: ReactNode;
  world: ReactNode;
  inspector: ReactNode;
  banner?: ReactNode;
};

export default function Layout({ topBar, world, inspector, banner }: Props) {
  return (
    <div className="grid h-full w-full grid-cols-[1fr_360px] grid-rows-[48px_1fr] bg-cream text-ink">
      <div className="relative z-30 col-span-2 border-b border-line bg-paper/85 backdrop-blur">
        {topBar}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-700/25 to-transparent" />
      </div>
      <main className="relative overflow-hidden bg-cream">
        {world}
        {banner && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center p-4">
            <div className="pointer-events-auto">{banner}</div>
          </div>
        )}
      </main>
      <aside className="relative overflow-y-auto border-l border-line bg-paper/70">
        {inspector}
      </aside>
    </div>
  );
}
