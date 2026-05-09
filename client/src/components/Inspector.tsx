import { useEffect, useRef, useState } from "react";
import type { AgentView } from "../lib/types";
import { getCharacter, type Character } from "../lib/characters";
import CharacterAvatar from "./CharacterAvatar";

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
  idle: "#6a5e4a",
  working: "#15803d",
  stuck: "#a16207",
  done: "#1d4ed8",
  error: "#b91c1c",
};

const ROLE_LABEL: Record<TranscriptEntry["role"], string> = {
  agent: "Agent",
  user: "You",
  system: "System",
};

// Map an agent back to a Character for portrait rendering. Falls through to a
// synthetic Character (no icon → initials fallback) for custom avatars that
// aren't in the static preset list.
function agentToCharacter(agent: AgentView): Character {
  const preset = getCharacter(agent.characterId);
  if (preset) return preset;
  return {
    id: agent.characterId,
    name: agent.name,
    icon: agent.sprite ?? "",
    color: agent.color,
    shortBio: "",
    systemPrompt: "",
  };
}

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
      <div className="flex h-full flex-col items-center justify-center p-6 text-center text-sm text-ink-soft">
        <div className="rounded-xl border border-line bg-paper p-5 shadow-lg shadow-amber-900/10">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-700">
            Inspector
          </div>
          <div className="mt-2 text-base font-semibold text-ink-muted">No agent selected</div>
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
  const startingUp = agent.status === "idle" && agent.runnerSpawnedAt !== undefined;

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line bg-paper/60 p-3">
        <div className="flex items-start gap-3">
          <CharacterAvatar
            character={agentToCharacter(agent)}
            size="md"
            style={{ boxShadow: `0 0 14px ${agent.color}33, inset 0 0 0 1.5px ${agent.color}` }}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-ink">{agent.name}</div>
            <div className="mt-1 flex items-center gap-2 text-xs">
              <span style={{ color: STATUS_COLOR[agent.status] }}>
                ●{" "}
                {queuedForRunner
                  ? "Queued for runner"
                  : startingUp
                    ? "Runner starting session…"
                    : STATUS_LABEL[agent.status]}
              </span>
              {typeof agent.progress === "number" && (
                <span className="text-ink-soft">
                  · {Math.round(agent.progress * 100)}%
                </span>
              )}
            </div>
          </div>
        </div>
        {typeof agent.progress === "number" && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{
                width: `${Math.round(agent.progress * 100)}%`,
                backgroundColor: agent.color,
                boxShadow: `0 0 8px ${agent.color}55`,
              }}
            />
          </div>
        )}
        <div className="mt-2 line-clamp-3 text-xs text-ink-muted">
          <span className="text-ink-soft">Task: </span>
          {agent.task}
        </div>
        {queuedForRunner && (
          <div className="mt-2 rounded-md border border-amber-700/30 bg-amber-100 px-2 py-1.5 text-xs text-amber-900">
            This agent has been queued in Convex and is waiting for the runner to claim it.
          </div>
        )}
        {startingUp && (
          <div className="mt-2 rounded-md border border-emerald-700/30 bg-emerald-100 px-2 py-1.5 text-xs text-emerald-900">
            Runner claimed this agent — spinning up the session. Watch the map: they walk to the nearest workshop ring.
          </div>
        )}
        {agent.lastMessage ? (
          <div className="mt-2 rounded-md border border-line bg-paper px-2 py-1.5 font-mono text-[10px] leading-snug text-ink-muted">
            <span className="text-ink-soft">Live: </span>
            <span className="break-words">{agent.lastMessage}</span>
          </div>
        ) : null}
      </header>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
        {transcript.length === 0 && (
          <div className="rounded-lg border border-line bg-paper/70 p-3 text-xs text-ink-soft">
            {startingUp || queuedForRunner
              ? "Transcript will appear when the runner connects and streams activity."
              : "No transcript yet. Activity from the runner shows up here in real time."}
          </div>
        )}
        {transcript.map((t) => (
          <div
            key={t.id}
            className={[
              "rounded-lg border px-2.5 py-2 text-xs leading-relaxed",
              t.role === "agent"
                ? "border-teal-700/25 bg-teal-50 text-teal-900"
                : t.role === "user"
                  ? "border-blue-700/25 bg-blue-50 text-blue-900"
                  : "border-line bg-paper/60 italic text-ink-soft",
            ].join(" ")}
          >
            <div className="mb-1 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-ink-soft">
              <span>{ROLE_LABEL[t.role]}</span>
              {t.userId && <span className="font-mono normal-case opacity-70">{t.userId.slice(-6)}</span>}
            </div>
            <div className="whitespace-pre-wrap break-words">{t.text}</div>
          </div>
        ))}
      </div>

      <footer className="border-t border-line bg-paper/60 p-2">
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
          className="w-full resize-none rounded-md border border-line bg-paper p-2 text-xs text-ink placeholder:text-ink-soft focus:border-line-strong focus:outline-none disabled:opacity-50"
          style={{ caretColor: agent.color }}
        />
        <div className="mt-1 flex items-center justify-between text-[10px] text-ink-soft">
          <span>Shift + Enter for newline</span>
          {sendPending && <span style={{ color: agent.color }}>Sending...</span>}
        </div>
      </footer>
    </div>
  );
}
