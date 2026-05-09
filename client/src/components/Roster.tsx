import type { Character } from "../lib/characters";
import RosterCard from "./RosterCard";

type Props = {
  characters: Character[];
  selectedCharacterId: string | null;
  onSelect: (id: string) => void;
  onCreateAvatar?: () => void;
  disabled?: boolean;
};

export default function Roster({
  characters,
  selectedCharacterId,
  onSelect,
  onCreateAvatar,
  disabled,
}: Props) {
  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between px-1 pb-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
          Roster
        </div>
        <div className="text-[10px] font-semibold text-stone-600">{characters.length} characters</div>
      </div>
      {characters.map((c) => (
        <RosterCard
          key={c.id}
          character={c}
          selected={selectedCharacterId === c.id}
          onClick={() => !disabled && onSelect(c.id)}
          disabled={disabled}
        />
      ))}
      {onCreateAvatar && (
        <button
          type="button"
          onClick={onCreateAvatar}
          className="mt-1 rounded-lg border border-dashed border-cyan-300/30 bg-cyan-950/20 p-3 text-left transition hover:border-cyan-200/60 hover:bg-cyan-950/35"
        >
          <div className="text-xs font-bold text-cyan-100">+ Create avatar</div>
          <div className="mt-0.5 text-[11px] text-stone-500">Choose a skill, role, and color</div>
        </button>
      )}
      <div className="mt-2 px-1 text-[10px] leading-relaxed text-stone-500">
        Click a character to spawn. Drag-and-drop coming in H6.
      </div>
    </div>
  );
}
