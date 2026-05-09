import { useEffect, useRef, useState } from "react";
import type { Character } from "../lib/characters";

type Props = {
  character: Character;
  onClose: () => void;
  onSubmit: (task: string, name?: string) => void | Promise<void>;
  isSubmitting?: boolean;
};

export default function SpawnModal({ character, onClose, onSubmit, isSubmitting }: Props) {
  const [name, setName] = useState("");
  const [task, setTask] = useState("");
  const taskRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    taskRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSubmitting, onClose]);

  const submit = async () => {
    if (!task.trim() || isSubmitting) return;
    await onSubmit(task.trim(), name.trim() || undefined);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-stone-700 bg-stone-950 p-5 shadow-2xl shadow-black/50"
        style={{ boxShadow: `0 0 36px ${character.color}18, 0 20px 70px rgba(0,0,0,0.55)` }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="spawn-modal-title"
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${character.color}88, transparent)`,
          }}
        />
        <div className="mb-4 flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-md text-sm font-bold text-stone-950"
            style={{
              background: `linear-gradient(180deg, ${character.color}, color-mix(in srgb, ${character.color} 60%, #0c0a09))`,
              boxShadow: `0 0 18px ${character.color}44`,
            }}
          >
            {character.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
              Spawn command
            </div>
            <div id="spawn-modal-title" className="text-base font-semibold text-stone-100">
              {character.name}
            </div>
            <div className="text-xs text-stone-400">{character.shortBio}</div>
          </div>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-400">
            Name (optional)
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={character.name}
            disabled={isSubmitting}
            className="w-full rounded-md border border-stone-800 bg-stone-950/80 p-2 text-sm text-stone-100 placeholder:text-stone-600 focus:outline-none disabled:opacity-60"
            style={{ caretColor: character.color }}
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-400">
            Task
          </span>
          <textarea
            ref={taskRef}
            value={task}
            onChange={(e) => setTask(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            placeholder="e.g. build a Fibonacci function in Python and run pytest on it"
            rows={4}
            disabled={isSubmitting}
            className="w-full resize-none rounded-md border border-stone-800 bg-stone-950/80 p-2 text-sm text-stone-100 placeholder:text-stone-600 focus:outline-none disabled:opacity-60"
            style={{ caretColor: character.color }}
          />
          <span className="mt-1 block text-[10px] text-stone-600">
            Press Cmd/Ctrl + Enter to deploy this agent.
          </span>
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-md border border-stone-700 bg-stone-900 px-3 py-1.5 text-sm text-stone-200 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!task.trim() || isSubmitting}
            className="rounded-md px-3 py-1.5 text-sm font-semibold text-stone-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: character.color }}
          >
            {isSubmitting ? "Spawning..." : "Spawn agent"}
          </button>
        </div>
      </div>
    </div>
  );
}
