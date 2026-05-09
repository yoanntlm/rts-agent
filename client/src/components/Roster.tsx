import type { Character } from "../lib/characters";
import RosterCard from "./RosterCard";

type Props = {
  characters: Character[];
  selectedCharacterId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
};

export default function Roster({ characters, selectedCharacterId, onSelect, disabled }: Props) {
  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-stone-500">
        Roster
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
      <div className="mt-2 px-1 text-[10px] leading-relaxed text-stone-500">
        Click a character to spawn. Drag-and-drop coming in H6.
      </div>
    </div>
  );
}
