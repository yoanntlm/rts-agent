import { useEffect, useMemo, useRef, useState } from "react";
import {
  AVATAR_COLORS,
  SKILL_PRESETS,
  createCustomCharacter,
  type CustomCharacterInput,
} from "../lib/customCharacters";
import type { Character } from "../lib/characters";

type Props = {
  onClose: () => void;
  onCreate: (character: Character) => void;
};

export default function CreateAvatarModal({ onClose, onCreate }: Props) {
  const [name, setName] = useState("");
  const [skillId, setSkillId] = useState(SKILL_PRESETS[0]!.id);
  const [color, setColor] = useState(AVATAR_COLORS[0]!);
  const nameRef = useRef<HTMLInputElement>(null);

  const selectedSkill = useMemo(
    () => SKILL_PRESETS.find((skill) => skill.id === skillId) ?? SKILL_PRESETS[0]!,
    [skillId],
  );
  const previewName = name.trim() || selectedSkill.label;

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = () => {
    const input: CustomCharacterInput = { name, skillId, color };
    onCreate(createCustomCharacter(input));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-avatar-title"
        className="relative w-full max-w-lg overflow-hidden rounded-xl border border-stone-700 bg-stone-950 p-5 shadow-2xl shadow-black/50"
        style={{ boxShadow: `0 0 36px ${color}18, 0 20px 70px rgba(0,0,0,0.55)` }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${color}88, transparent)` }}
        />

        <div className="mb-4 flex items-start gap-3">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-base font-black text-stone-950"
            style={{
              background: `linear-gradient(180deg, ${color}, color-mix(in srgb, ${color} 58%, #0c0a09))`,
              boxShadow: `0 0 22px ${color}55`,
            }}
          >
            {previewName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">
              Avatar creator
            </div>
            <h2 id="create-avatar-title" className="mt-1 text-lg font-semibold text-stone-100">
              Create a team specialist
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-stone-400">
              Pick a role and visual identity. This becomes a reusable avatar in your roster.
            </p>
          </div>
        </div>

        <label className="mb-4 block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-400">
            Avatar name
          </span>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={selectedSkill.label}
            className="w-full rounded-md border border-stone-800 bg-stone-950/80 p-2 text-sm text-stone-100 placeholder:text-stone-600 focus:outline-none"
            style={{ caretColor: color }}
          />
        </label>

        <div className="mb-4">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-400">
            Skill focus
          </div>
          <div className="grid grid-cols-2 gap-2">
            {SKILL_PRESETS.map((skill) => {
              const selected = skill.id === skillId;
              return (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => setSkillId(skill.id)}
                  className="rounded-lg border p-2 text-left transition duration-200 hover:-translate-y-0.5"
                  style={{
                    borderColor: selected ? `${color}66` : "rgba(68,64,60,0.9)",
                    background: selected ? `${color}12` : "rgba(28,25,23,0.72)",
                    boxShadow: selected ? `0 0 16px ${color}18` : undefined,
                  }}
                >
                  <div className="text-xs font-semibold text-stone-100">{skill.label}</div>
                  <div className="mt-0.5 text-[10px] leading-relaxed text-stone-500">
                    {skill.shortBio}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-5">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-400">
            Avatar color
          </div>
          <div className="flex flex-wrap gap-2">
            {AVATAR_COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`Use ${swatch}`}
                onClick={() => setColor(swatch)}
                className="h-8 w-8 rounded-lg border border-stone-900 transition hover:scale-105"
                style={{
                  backgroundColor: swatch,
                  boxShadow: color === swatch ? `0 0 0 2px #0c0a09, 0 0 0 4px ${swatch}` : undefined,
                }}
              />
            ))}
          </div>
        </div>

        <div className="mb-5 rounded-lg border border-stone-800 bg-stone-950/60 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
            Prompt preview
          </div>
          <p className="mt-1 text-xs leading-relaxed text-stone-300">
            {previewName} specializes in {selectedSkill.promptFocus}.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-stone-700 bg-stone-900 px-3 py-1.5 text-sm text-stone-200 transition hover:bg-stone-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className="rounded-md px-3 py-1.5 text-sm font-semibold text-stone-950 transition hover:brightness-110"
            style={{ backgroundColor: color }}
          >
            Add to roster
          </button>
        </div>
      </div>
    </div>
  );
}
