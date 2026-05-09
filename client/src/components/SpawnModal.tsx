import { useEffect, useRef, useState } from "react";
import type { Character } from "../lib/characters";

type Props = {
  character: Character;
  onClose: () => void;
  onSubmit: (task: string, name?: string) => void;
};

export default function SpawnModal({ character, onClose, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [task, setTask] = useState("");
  const taskRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    taskRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = () => {
    if (!task.trim()) return;
    onSubmit(task.trim(), name.trim() || undefined);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-stone-700 bg-stone-900 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-md text-sm font-bold text-stone-950"
            style={{ backgroundColor: character.color }}
          >
            {character.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-semibold text-stone-100">
              Spawn {character.name}
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
            className="w-full rounded-md border border-stone-700 bg-stone-950 p-2 text-sm text-stone-100 placeholder:text-stone-600 focus:border-stone-500 focus:outline-none"
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
            className="w-full resize-none rounded-md border border-stone-700 bg-stone-950 p-2 text-sm text-stone-100 placeholder:text-stone-600 focus:border-stone-500 focus:outline-none"
          />
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-stone-700 bg-stone-800 px-3 py-1.5 text-sm text-stone-200 hover:bg-stone-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!task.trim()}
            className="rounded-md bg-stone-100 px-3 py-1.5 text-sm font-semibold text-stone-950 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Spawn ⤵
          </button>
        </div>
      </div>
    </div>
  );
}
