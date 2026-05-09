import type { Character } from "../lib/characters";

type Props = {
  character: Character;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
};

export default function RosterCard({ character, selected, onClick, disabled }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "group flex items-center gap-3 rounded-lg border p-2 text-left transition",
        "disabled:cursor-not-allowed disabled:opacity-50",
        selected
          ? "border-stone-500 bg-stone-800"
          : "border-stone-800 bg-stone-900 hover:border-stone-700 hover:bg-stone-800/70",
      ].join(" ")}
      style={selected ? { boxShadow: `inset 0 0 0 1px ${character.color}` } : undefined}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-sm font-bold text-stone-950"
        style={{ backgroundColor: character.color }}
      >
        {character.name.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{character.name}</div>
        <div className="truncate text-xs text-stone-400">{character.shortBio}</div>
      </div>
    </button>
  );
}
