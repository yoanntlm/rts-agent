import { useState } from "react";

type User = { _id: string; name: string; color: string };
export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";
type PreviewLink = { port: number; url: string };

type Props = {
  roomName: string;
  users: User[];
  selfUserId?: string | null;
  connectionStatus?: ConnectionStatus;
  runnerBanner?: string | null;
  previewUrls?: PreviewLink[];
};

const PORT_LABELS: Record<number, string> = {
  3000: "Express / Next.js",
  5173: "Vite",
  8000: "Python / Django",
  8080: "Webpack / CRA",
};

const CONNECTION_META: Record<
  ConnectionStatus,
  { label: string; color: string; glow: string }
> = {
  connected: {
    label: "Connected",
    color: "#15803d",
    glow: "rgba(21,128,61,0.25)",
  },
  reconnecting: {
    label: "Reconnecting",
    color: "#b45309",
    glow: "rgba(180,83,9,0.25)",
  },
  disconnected: {
    label: "Disconnected",
    color: "#b91c1c",
    glow: "rgba(185,28,28,0.25)",
  },
};

export default function TopBar({
  roomName,
  users,
  selfUserId,
  connectionStatus = "connected",
  runnerBanner,
  previewUrls,
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
    <div className="flex h-full items-center justify-between px-4">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <span className="text-base font-bold tracking-tight text-ink transition-[letter-spacing] duration-200 ease-out hover:tracking-[0.03em]">
          LeagueCode
        </span>
        <span className="text-ink-soft">·</span>
        <span className="text-sm text-ink-muted">
          Room: <span className="font-medium text-ink">{roomName}</span>
        </span>
        <span className="flex items-center gap-1.5 rounded-full border border-line bg-paper px-2 py-1 text-[10px] font-medium text-ink-muted">
          <span
            className="h-2 w-2 rounded-full"
            style={{
              backgroundColor: connection.color,
              boxShadow: `0 0 8px ${connection.glow}`,
            }}
          />
          {connection.label}
        </span>
        {runnerBanner ? (
          <span
            className="max-w-[min(280px,40vw)] truncate rounded-full border border-amber-700/30 bg-amber-100 px-2 py-1 text-[10px] font-medium text-amber-900"
            title={runnerBanner}
          >
            {runnerBanner}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        {previewUrls && previewUrls.length > 0 && (
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md border border-emerald-700/30 bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-900 transition hover:border-emerald-700/50 hover:bg-emerald-200">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
              </span>
              Preview ↗
            </summary>
            <div className="absolute right-0 top-full z-30 mt-1 w-64 rounded-lg border border-line bg-paper p-1 shadow-xl">
              {previewUrls.map((p) => (
                <a
                  key={p.port}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded px-2 py-1.5 text-xs text-ink-muted hover:bg-paper-hover"
                >
                  <span>
                    Port <span className="font-semibold text-ink">{p.port}</span>
                    <span className="ml-2 text-ink-soft">{PORT_LABELS[p.port] ?? ""}</span>
                  </span>
                  <span className="text-ink-soft">↗</span>
                </a>
              ))}
            </div>
          </details>
        )}
        <a
          href={`/r/${roomName}/editor`}
          className="rounded border border-line px-2 py-1 text-xs text-ink-muted transition hover:border-line-strong hover:bg-paper-hover"
          title="Open the worldbuilder"
        >
          Edit map
        </a>
        <span className="text-xs text-ink-soft">
          {users.length === 0
            ? "no devs online"
            : `${users.length} dev${users.length === 1 ? "" : "s"} online`}
        </span>
        <div className="flex -space-x-2">
          {users.slice(0, 6).map((u) => (
            <div
              key={u._id}
              title={u.name + (u._id === selfUserId ? " (you)" : "")}
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-paper text-[10px] font-bold uppercase text-stone-950"
              style={{
                backgroundColor: u.color,
                boxShadow: `0 0 0 1px ${u.color}66, 0 0 10px ${u.color}33`,
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
            className="rounded-md border border-cyan-700/30 bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-900 transition duration-200 hover:border-cyan-700/50 hover:bg-cyan-100"
          >
            Share Room
          </button>
          {copied && (
            <div className="absolute right-0 top-full mt-1 rounded-md border border-line bg-paper px-2 py-1 text-[10px] font-medium text-ink shadow-lg">
              Copied!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
