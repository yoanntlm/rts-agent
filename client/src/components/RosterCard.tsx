import type { CSSProperties, KeyboardEvent } from "react";
import type { Character } from "../lib/characters";

type Props = {
  character: Character;
  selected: boolean;
  onClick: () => void;
  onPointerDown?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
};

export default function RosterCard({
  character,
  selected,
  onClick,
  onPointerDown,
  onKeyDown,
  disabled,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => {
        if (e.button === 0 && !disabled) onPointerDown?.();
      }}
      disabled={disabled}
      aria-pressed={selected}
      className={[
        "group relative flex items-center gap-3 overflow-hidden rounded-lg border p-2 pl-3 text-left transition duration-200 ease-out",
        "hover:-translate-y-0.5",
        "disabled:cursor-not-allowed disabled:opacity-50",
        selected
          ? "border-stone-700 bg-stone-900"
          : "border-stone-800 bg-stone-900 hover:bg-stone-800/70",
      ].join(" ")}
      style={{
        borderColor: selected ? `${character.color}66` : undefined,
        background: selected
          ? `linear-gradient(135deg, ${character.color}0d, rgba(28,25,23,0.92) 42%, rgba(12,10,9,0.9))`
          : undefined,
        boxShadow: selected
          ? `0 0 22px ${character.color}24, inset 0 0 0 1px ${character.color}33`
          : undefined,
        "--character-color": `${character.color}55`,
      } as CSSProperties}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${character.color}4d`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = selected ? `${character.color}66` : "";
      }}
    >
      <div
        className={[
          "absolute inset-y-1 left-1 w-[3px] rounded-full",
          selected ? "animate-pulse" : "",
        ].join(" ")}
        style={{
          backgroundColor: character.color,
          boxShadow: selected ? `0 0 14px ${character.color}66` : `0 0 8px ${character.color}22`,
        }}
      />
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-sm font-bold text-stone-950 transition duration-200 group-hover:shadow-[0_0_18px_var(--character-color)]"
        style={{
          background: `linear-gradient(180deg, ${character.color}, color-mix(in srgb, ${character.color} 62%, #0c0a09))`,
          boxShadow: selected ? `0 0 18px ${character.color}55` : undefined,
        }}
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
