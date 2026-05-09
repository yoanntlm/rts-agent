import { TILE_KINDS, TILE_LABEL, TILE_PATHS, type TileKind } from "../../lib/tiles";

type Props = {
  selected: TileKind;
  onSelect: (kind: TileKind) => void;
};

export default function TilePalette({ selected, onSelect }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {TILE_KINDS.map((kind) => {
        const isSelected = kind === selected;
        return (
          <button
            key={kind}
            type="button"
            onClick={() => onSelect(kind)}
            className={`group relative flex flex-col items-center gap-1 rounded border p-2 transition ${
              isSelected
                ? "border-amber-400 bg-amber-400/10"
                : "border-stone-700 bg-stone-900 hover:border-stone-500"
            }`}
            title={TILE_LABEL[kind]}
          >
            <img
              src={TILE_PATHS[kind]}
              alt={TILE_LABEL[kind]}
              className="h-12 w-12 rounded-sm"
              style={{ imageRendering: "pixelated" }}
              draggable={false}
            />
            <span className="text-[10px] uppercase tracking-wide text-stone-300">
              {TILE_LABEL[kind]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
