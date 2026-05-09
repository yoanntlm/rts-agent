import { useState } from "react";

type User = { _id: string; name: string; color: string };
export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

type Props = {
  roomName: string;
  users: User[];
  selfUserId?: string | null;
  connectionStatus?: ConnectionStatus;
  runnerBanner?: string | null;
};

const CONNECTION_META: Record<
  ConnectionStatus,
  { label: string; color: string; glow: string }
> = {
  connected: {
    label: "Connected",
    color: "#22c55e",
    glow: "rgba(34,197,94,0.35)",
  },
  reconnecting: {
    label: "Reconnecting",
    color: "#f59e0b",
    glow: "rgba(245,158,11,0.35)",
  },
  disconnected: {
    label: "Disconnected",
    color: "#ef4444",
    glow: "rgba(239,68,68,0.35)",
  },
};

export default function TopBar({
  roomName,
  users,
  selfUserId,
  connectionStatus = "connected",
  runnerBanner,
}: Props) {
  const [copied, setCopied] = useState(false);
  const connection = CONNECTION_META[connectionStatus];

  const shareRoom = async () => {
    const url = window.location.href;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
    } else {
      window.prompt("Copy room URL", url);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="flex h-full items-center justify-between bg-gradient-to-r from-stone-900 via-stone-900/80 to-transparent px-4">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <span className="text-base font-bold tracking-tight transition-[letter-spacing] duration-200 ease-out hover:tracking-[0.03em]">
          rts-agent
        </span>
        <span className="text-stone-500">·</span>
        <span className="text-sm text-stone-300">
          Room: <span className="font-medium text-stone-100">{roomName}</span>
        </span>
        <span className="flex items-center gap-1.5 rounded-full border border-stone-800 bg-stone-950/50 px-2 py-1 text-[10px] font-medium text-stone-400">
          <span
            className="h-2 w-2 rounded-full"
            style={{
              backgroundColor: connection.color,
              boxShadow: `0 0 10px ${connection.glow}`,
            }}
          />
          {connection.label}
        </span>
        {runnerBanner ? (
          <span
            className="max-w-[min(280px,40vw)] truncate rounded-full border border-amber-200/15 bg-amber-400/5 px-2 py-1 text-[10px] font-medium text-amber-100/90"
            title={runnerBanner}
          >
            {runnerBanner}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <a
          href="/editor"
          className="rounded border border-stone-700 px-2 py-1 text-xs text-stone-300 hover:border-stone-500"
          title="Open the worldbuilder"
        >
          Edit map
        </a>
        <span className="text-xs text-stone-500">
          {users.length === 0
            ? "no devs online"
            : `${users.length} dev${users.length === 1 ? "" : "s"} online`}
        </span>
        <div className="flex -space-x-2">
          {users.slice(0, 6).map((u) => (
            <div
              key={u._id}
              title={u.name + (u._id === selfUserId ? " (you)" : "")}
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-stone-900 text-[10px] font-bold uppercase text-stone-950"
              style={{
                backgroundColor: u.color,
                boxShadow: `0 0 0 1px ${u.color}55, 0 0 14px ${u.color}33`,
              }}
            >
              {u.name.slice(0, 2)}
            </div>
          ))}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={shareRoom}
            className="rounded-md border border-cyan-200/15 bg-cyan-300/5 px-2.5 py-1 text-xs font-medium text-cyan-100 transition duration-200 hover:border-cyan-200/30 hover:bg-cyan-300/10 hover:shadow-[0_0_16px_rgba(78,205,196,0.14)]"
          >
            Share Room
          </button>
          {copied && (
            <div className="absolute right-0 top-full mt-1 rounded-md border border-stone-700 bg-stone-950 px-2 py-1 text-[10px] font-medium text-stone-200 shadow-lg">
              Copied!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
