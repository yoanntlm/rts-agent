import type { Character } from "../lib/characters";
import RosterCard from "./RosterCard";

type Props = {
  characters: Character[];
  selectedCharacterId: string | null;
  onSelect: (id: string) => void;
  onDescribeTask?: () => void;
  onBeginDrag?: (id: string) => void;
  onCreateAvatar?: () => void;
  disabled?: boolean;
};

export default function Roster({
  characters,
  selectedCharacterId,
  onSelect,
  onDescribeTask,
  onBeginDrag,
  onCreateAvatar,
  disabled,
}: Props) {
  const selectedCharacter = characters.find((c) => c.id === selectedCharacterId) ?? null;

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex items-center justify-between px-1 pb-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
          Roster
        </div>
        <div className="text-[10px] font-medium text-stone-500">
          {characters.length} characters
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {characters.map((c) => (
          <RosterCard
            key={c.id}
            character={c}
            selected={selectedCharacterId === c.id}
            onClick={() => !disabled && onSelect(c.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && selectedCharacterId === c.id && onDescribeTask) {
                event.preventDefault();
                onDescribeTask();
              }
            }}
            onPointerDown={() => onBeginDrag?.(c.id)}
            disabled={disabled}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onCreateAvatar}
        disabled={!onCreateAvatar}
        className="mt-1 rounded-lg border border-dashed border-cyan-200/20 bg-cyan-300/5 px-3 py-2 text-left text-xs font-semibold text-cyan-100 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-200/35 hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        + Create avatar
        <span className="mt-0.5 block text-[10px] font-normal text-stone-500">
          Choose a skill, role, and color
        </span>
      </button>

      <div className="mt-auto px-1 pt-3">
        {selectedCharacter ? (
          <button
            type="button"
            onClick={onDescribeTask}
            disabled={disabled || !onDescribeTask}
            className="w-full rounded-lg border px-3 py-2 text-left text-xs font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              borderColor: `${selectedCharacter.color}40`,
              background: `linear-gradient(135deg, ${selectedCharacter.color}14, rgba(28,25,23,0.78))`,
              boxShadow: `0 0 18px ${selectedCharacter.color}14`,
              color: selectedCharacter.color,
            }}
          >
            Describe task →
          </button>
        ) : (
          <div className="text-[10px] leading-relaxed text-stone-600">
            Click a character, then describe their task. Drag onto the map to pick a tile.
          </div>
        )}
      </div>
    </div>
  );
}
