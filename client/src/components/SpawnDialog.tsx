import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Character } from "../lib/characters";
import CharacterAvatar from "./CharacterAvatar";

type Props = {
  characters: Character[];
  onClose: () => void;
  onSubmit: (characterId: string, task: string, name?: string) => void | Promise<void>;
  onCreateAvatar?: () => void;
  isSubmitting?: boolean;
  // Pre-selected character (e.g. from a freshly created custom avatar). When set,
  // the dialog opens directly on step 2 with this character chosen.
  initialCharacterId?: string | null;
};

type Step = "pick" | "task";

export default function SpawnDialog({
  characters,
  onClose,
  onSubmit,
  onCreateAvatar,
  isSubmitting,
  initialCharacterId,
}: Props) {
  const [step, setStep] = useState<Step>(initialCharacterId ? "task" : "pick");
  const [pickedId, setPickedId] = useState<string | null>(initialCharacterId ?? null);
  const [name, setName] = useState("");
  const [task, setTask] = useState("");
  const taskRef = useRef<HTMLTextAreaElement>(null);

  // Bring focus into the task field when the user advances to step 2.
  useEffect(() => {
    if (step === "task") taskRef.current?.focus();
  }, [step]);

  // Esc closes the dialog (only when not mid-submit).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSubmitting, onClose]);

  // If the parent injects a freshly-created avatar (initialCharacterId flips
  // from null → some id), jump straight to step 2 and select it.
  useEffect(() => {
    if (initialCharacterId) {
      setPickedId(initialCharacterId);
      setStep("task");
    }
  }, [initialCharacterId]);

  const picked = pickedId ? characters.find((c) => c.id === pickedId) ?? null : null;

  const submit = async () => {
    if (!picked || !task.trim() || isSubmitting) return;
    await onSubmit(picked.id, task.trim(), name.trim() || undefined);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-line bg-paper shadow-2xl shadow-amber-900/15"
        style={{
          boxShadow: picked
            ? `0 0 28px ${picked.color}20, 0 20px 60px rgba(60,40,10,0.18)`
            : "0 20px 60px rgba(60,40,10,0.18)",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="spawn-dialog-title"
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background: picked
              ? `linear-gradient(90deg, transparent, ${picked.color}88, transparent)`
              : "linear-gradient(90deg, transparent, rgba(8,140,135,0.45), transparent)",
          }}
        />

        {step === "pick" ? (
          <PickStep
            characters={characters}
            onPick={(id) => {
              setPickedId(id);
              setStep("task");
            }}
            onCreateAvatar={onCreateAvatar}
            onClose={onClose}
          />
        ) : picked ? (
          <TaskStep
            character={picked}
            name={name}
            task={task}
            onChangeName={setName}
            onChangeTask={setTask}
            onBack={() => setStep("pick")}
            onSubmit={submit}
            onClose={onClose}
            isSubmitting={isSubmitting}
            taskRef={taskRef}
          />
        ) : null}
      </div>
    </div>
  );
}

function PickStep({
  characters,
  onPick,
  onCreateAvatar,
  onClose,
}: {
  characters: Character[];
  onPick: (id: string) => void;
  onCreateAvatar?: () => void;
  onClose: () => void;
}) {
  return (
    <div className="p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-800">
            Step 1 of 2
          </div>
          <div id="spawn-dialog-title" className="text-base font-semibold text-ink">
            Pick a specialist
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-line bg-paper-hover px-2 py-1 text-xs text-ink-muted transition hover:bg-cream hover:text-ink"
          aria-label="Close"
        >
          Esc
        </button>
      </div>

      <div className="grid max-h-[60vh] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
        {characters.map((c) => (
          <CharacterTile key={c.id} character={c} onClick={() => onPick(c.id)} />
        ))}
        {onCreateAvatar && <CreateTile onClick={onCreateAvatar} />}
      </div>
    </div>
  );
}

function CharacterTile({
  character,
  onClick,
}: {
  character: Character;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col items-stretch gap-2 overflow-hidden rounded-lg border border-line bg-paper-hover p-2 text-left transition duration-200 hover:-translate-y-0.5 hover:border-line-strong"
      style={{ "--character-color": `${character.color}55` } as CSSProperties}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${character.color}66`;
        e.currentTarget.style.boxShadow = `0 0 20px ${character.color}22`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "";
        e.currentTarget.style.boxShadow = "";
      }}
    >
      <CharacterAvatar
        character={character}
        size="lg"
        className="transition duration-200 group-hover:shadow-[0_0_18px_var(--character-color)]"
      />
      <div className="min-w-0">
        <div className="truncate text-xs font-semibold text-ink">{character.name}</div>
        <div className="truncate text-[10px] text-ink-soft">{character.shortBio}</div>
      </div>
    </button>
  );
}

function CreateTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-stretch gap-2 overflow-hidden rounded-lg border border-dashed border-cyan-700/35 bg-cyan-50 p-2 text-left transition duration-200 hover:-translate-y-0.5 hover:border-cyan-700/55 hover:bg-cyan-100"
    >
      <div className="flex aspect-square w-full items-center justify-center rounded-md border border-dashed border-cyan-700/40 text-2xl font-thin text-cyan-700">
        +
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs font-semibold text-cyan-900">Create avatar</div>
        <div className="truncate text-[10px] text-ink-soft">Custom skill + color</div>
      </div>
    </button>
  );
}

function TaskStep({
  character,
  name,
  task,
  onChangeName,
  onChangeTask,
  onBack,
  onSubmit,
  onClose,
  isSubmitting,
  taskRef,
}: {
  character: Character;
  name: string;
  task: string;
  onChangeName: (v: string) => void;
  onChangeTask: (v: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  onClose: () => void;
  isSubmitting?: boolean;
  taskRef: React.RefObject<HTMLTextAreaElement>;
}) {
  return (
    <div className="p-5">
      <div className="mb-4 flex items-center gap-3">
        <CharacterAvatar
          character={character}
          size="md"
          style={{ boxShadow: `0 0 14px ${character.color}33, inset 0 0 0 1.5px ${character.color}` }}
        />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-800">
            Step 2 of 2 · Spawn command
          </div>
          <div className="truncate text-base font-semibold text-ink">{character.name}</div>
          <div className="truncate text-xs text-ink-soft">{character.shortBio}</div>
        </div>
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="rounded-md border border-line bg-paper-hover px-2 py-1 text-xs text-ink-muted transition hover:bg-cream hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          ← Pick another
        </button>
      </div>

      <label className="mb-3 block">
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ink-soft">
          Name (optional)
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => onChangeName(e.target.value)}
          placeholder={character.name}
          disabled={isSubmitting}
          className="w-full rounded-md border border-line bg-cream/80 p-2 text-sm text-ink placeholder:text-ink-soft focus:border-line-strong focus:outline-none disabled:opacity-60"
          style={{ caretColor: character.color }}
        />
      </label>

      <label className="mb-4 block">
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ink-soft">
          Task
        </span>
        <textarea
          ref={taskRef}
          value={task}
          onChange={(e) => onChangeTask(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSubmit();
          }}
          placeholder="e.g. build a Fibonacci function in Python and run pytest on it"
          rows={4}
          disabled={isSubmitting}
          className="w-full resize-none rounded-md border border-line bg-cream/80 p-2 text-sm text-ink placeholder:text-ink-soft focus:border-line-strong focus:outline-none disabled:opacity-60"
          style={{ caretColor: character.color }}
        />
        <span className="mt-1 block text-[10px] text-ink-soft">
          Press Cmd/Ctrl + Enter to deploy this agent.
        </span>
      </label>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="rounded-md border border-line bg-paper-hover px-3 py-1.5 text-sm text-ink-muted transition hover:bg-cream hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!task.trim() || isSubmitting}
          className="rounded-md px-3 py-1.5 text-sm font-semibold text-stone-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: character.color }}
        >
          {isSubmitting ? "Spawning..." : "Spawn agent"}
        </button>
      </div>
    </div>
  );
}
