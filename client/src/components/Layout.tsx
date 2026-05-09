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
      <div className="relative col-span-3 border-b border-cyan-200/10 bg-stone-950/80 backdrop-blur">
        {topBar}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent shadow-[0_0_14px_rgba(78,205,196,0.12)]" />
      </div>
      <aside className="relative overflow-y-auto border-r border-cyan-200/10 bg-stone-900/50 shadow-[inset_1px_0_0_rgba(78,205,196,0.14)]">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-teal-300/30 to-transparent shadow-[0_0_14px_rgba(78,205,196,0.16)]" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-cyan-300/24 to-transparent shadow-[0_0_16px_rgba(78,205,196,0.14)]" />
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
      <aside className="relative overflow-y-auto border-l border-purple-200/10 bg-stone-900/50 shadow-[inset_-1px_0_0_rgba(167,139,250,0.14)]">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-purple-300/24 to-transparent shadow-[0_0_16px_rgba(167,139,250,0.14)]" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-fuchsia-300/30 to-transparent shadow-[0_0_14px_rgba(167,139,250,0.16)]" />
        {inspector}
      </aside>
    </div>
  );
}
