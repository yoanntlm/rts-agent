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
  onSendMessage: (text: string) => void;
  disabled?: boolean;
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

export default function Inspector({ agent, transcript, onSendMessage, disabled }: Props) {
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
        <div className="text-base font-semibold text-stone-400">No agent selected</div>
        <p className="mt-2 max-w-[24ch] text-xs">
          Click a character on the left to spawn one, or click an agent in the world to inspect it.
        </p>
      </div>
    );
  }

  const submit = () => {
    if (!draft.trim() || disabled) return;
    onSendMessage(draft);
    setDraft("");
  };

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-stone-800 p-3">
        <div className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: agent.color }}
          />
          <div className="truncate text-sm font-semibold">{agent.name}</div>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs">
          <span style={{ color: STATUS_COLOR[agent.status] }}>
            ● {STATUS_LABEL[agent.status]}
          </span>
          {typeof agent.progress === "number" && (
            <span className="text-stone-500">
              · {Math.round(agent.progress * 100)}%
            </span>
          )}
        </div>
        <div className="mt-2 line-clamp-3 text-xs text-stone-400">
          <span className="text-stone-500">Task: </span>
          {agent.task}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
        {transcript.length === 0 && (
          <div className="text-xs text-stone-500">No messages yet.</div>
        )}
        {transcript.map((t) => (
          <div
            key={t.id}
            className={[
              "rounded-md px-2 py-1.5 text-xs leading-relaxed",
              t.role === "agent"
                ? "bg-stone-800/60 text-stone-200"
                : t.role === "user"
                  ? "bg-blue-900/40 text-blue-100"
                  : "italic text-stone-500",
            ].join(" ")}
          >
            <div className="mb-0.5 text-[9px] font-bold uppercase tracking-wider text-stone-500">
              {t.role}
            </div>
            <div className="whitespace-pre-wrap break-words">{t.text}</div>
          </div>
        ))}
      </div>

      <footer className="border-t border-stone-800 p-2">
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          disabled={disabled}
          placeholder={
            disabled ? "Agent runner offline…" : "Type a hint… (Enter to send)"
          }
          rows={2}
          className="w-full resize-none rounded-md border border-stone-800 bg-stone-950 p-2 text-xs text-stone-100 placeholder:text-stone-600 focus:border-stone-600 focus:outline-none disabled:opacity-50"
        />
      </footer>
    </div>
  );
}
