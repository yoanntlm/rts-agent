import type { ReactNode } from "react";

type Props = {
  topBar: ReactNode;
  roster: ReactNode;
  world: ReactNode;
  inspector: ReactNode;
  banner?: ReactNode;
};

export default function Layout({ topBar, roster, world, inspector, banner }: Props) {
  return (
    <div className="grid h-full w-full grid-cols-[260px_1fr_360px] grid-rows-[48px_1fr] bg-stone-950 text-stone-100">
      <div className="col-span-3 border-b border-stone-800 bg-stone-900/80 backdrop-blur">
        {topBar}
      </div>
      <aside className="overflow-y-auto border-r border-stone-800 bg-stone-900/50">
        {roster}
      </aside>
      <main className="relative overflow-hidden bg-stone-950">
        {world}
        {banner && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center p-4">
            <div className="pointer-events-auto">{banner}</div>
          </div>
        )}
      </main>
      <aside className="overflow-y-auto border-l border-stone-800 bg-stone-900/50">
        {inspector}
      </aside>
    </div>
  );
}
