type Props = {
  onClick: () => void;
  disabled?: boolean;
};

export default function SpawnButton({ onClick, disabled }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="absolute left-3 top-3 z-20 flex items-center gap-2 rounded-lg border border-cyan-700/35 bg-paper/95 px-3 py-2 text-xs font-semibold text-cyan-900 shadow-md shadow-amber-900/10 backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:border-cyan-700/55 hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="text-base leading-none text-cyan-700">+</span>
      Spawn agent
    </button>
  );
}
