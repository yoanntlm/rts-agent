import { useEffect, useRef, useState } from "react";
import type { AgentView } from "../lib/types";

type TranscriptEntry = {
  id: string;
  role: "agent" | "user" | "system";
  text: string;
  userId: string | null;
};

type Props = {
  agent: AgentView | null;
  transcript: TranscriptEntry[];
  onSendMessage: (text: string) => void | Promise<void>;
  disabled?: boolean;
  sendPending?: boolean;
};

const STATUS_LABEL: Record<AgentView["status"], string> = {
  idle: "Idle",
  working: "Working",
  stuck: "Stuck — needs help",
  done: "Done",
  error: "Error",
};

const STATUS_COLOR: Record<AgentView["status"], string> = {
  idle: "#a8a29e",
  working: "#34d399",
  stuck: "#facc15",
  done: "#60a5fa",
  error: "#f87171",
};

const ROLE_LABEL: Record<TranscriptEntry["role"], string> = {
  agent: "Agent",
  user: "You",
  system: "System",
};

export default function Inspector({
  agent,
  transcript,
  onSendMessage,
  disabled,
  sendPending,
}: Props) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Focus input when an agent becomes selected, especially handy when stuck.
  useEffect(() => {
    if (agent && agent.status === "stuck") inputRef.current?.focus();
  }, [agent?.id, agent?.status]);

  // Autoscroll on new transcript.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript.length]);

  if (!agent) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center text-sm text-stone-500">
        <div className="rounded-xl border border-purple-200/10 bg-stone-950/60 p-5 shadow-2xl shadow-black/30">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-200/70">
            Inspector
          </div>
          <div className="mt-2 text-base font-semibold text-stone-300">No agent selected</div>
          <p className="mt-2 max-w-[24ch] text-xs">
            Spawn an agent from the roster, then click its marker in the world to inspect live progress.
          </p>
        </div>
      </div>
    );
  }

  const submit = async () => {
    if (!draft.trim() || disabled || sendPending) return;
    await onSendMessage(draft);
    setDraft("");
  };
  const queuedForRunner = agent.status === "idle" && agent.runnerSpawnedAt === undefined;

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-purple-200/10 bg-stone-950/30 p-3">
        <div className="flex items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-black text-stone-950"
            style={{
              background: `linear-gradient(180deg, ${agent.color}, color-mix(in srgb, ${agent.color} 58%, #0c0a09))`,
              boxShadow: `0 0 18px ${agent.color}44`,
            }}
          >
            {agent.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-stone-100">{agent.name}</div>
            <div className="mt-1 flex items-center gap-2 text-xs">
              <span style={{ color: STATUS_COLOR[agent.status] }}>
                ● {queuedForRunner ? "Queued for runner" : STATUS_LABEL[agent.status]}
              </span>
              {typeof agent.progress === "number" && (
                <span className="text-stone-500">
                  · {Math.round(agent.progress * 100)}%
                </span>
              )}
            </div>
          </div>
        </div>
        {typeof agent.progress === "number" && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-800">
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{
                width: `${Math.round(agent.progress * 100)}%`,
                backgroundColor: agent.color,
                boxShadow: `0 0 12px ${agent.color}66`,
              }}
            />
          </div>
        )}
        <div className="mt-2 line-clamp-3 text-xs text-stone-400">
          <span className="text-stone-500">Task: </span>
          {agent.task}
        </div>
        {queuedForRunner && (
          <div className="mt-2 rounded-md border border-amber-200/10 bg-amber-950/20 px-2 py-1.5 text-xs text-amber-100/80">
            This agent has been queued in Convex and is waiting for the runner to claim it.
          </div>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
        {transcript.length === 0 && (
          <div className="rounded-lg border border-stone-800 bg-stone-950/60 p-3 text-xs text-stone-500">
            No transcript yet. The runner will stream activity here once it claims this agent.
          </div>
        )}
        {transcript.map((t) => (
          <div
            key={t.id}
            className={[
              "rounded-lg border px-2.5 py-2 text-xs leading-relaxed",
              t.role === "agent"
                ? "border-teal-200/10 bg-teal-950/20 text-teal-50"
                : t.role === "user"
                  ? "border-blue-200/10 bg-blue-950/25 text-blue-50"
                  : "border-stone-800 bg-stone-950/50 italic text-stone-500",
            ].join(" ")}
          >
            <div className="mb-1 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-stone-500">
              <span>{ROLE_LABEL[t.role]}</span>
              {t.userId && <span className="font-mono normal-case opacity-60">{t.userId.slice(-6)}</span>}
            </div>
            <div className="whitespace-pre-wrap break-words">{t.text}</div>
          </div>
        ))}
      </div>

      <footer className="border-t border-purple-200/10 bg-stone-950/30 p-2">
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          disabled={disabled || sendPending}
          placeholder={
            disabled ? "Agent runner offline..." : "Type a hint... (Enter to send)"
          }
          rows={2}
          className="w-full resize-none rounded-md border border-stone-800 bg-stone-950 p-2 text-xs text-stone-100 placeholder:text-stone-600 focus:outline-none disabled:opacity-50"
          style={{ caretColor: agent.color }}
        />
        <div className="mt-1 flex items-center justify-between text-[10px] text-stone-600">
          <span>Shift + Enter for newline</span>
          {sendPending && <span style={{ color: agent.color }}>Sending...</span>}
        </div>
      </footer>
    </div>
  );
}
