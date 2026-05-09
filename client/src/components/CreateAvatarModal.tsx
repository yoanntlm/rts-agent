import { useEffect, useMemo, useRef, useState } from "react";
import type { Character } from "../lib/characters";
import {
  AVATAR_COLORS,
  SKILL_PRESETS,
  createCustomCharacter,
} from "../lib/customCharacters";

type Props = {
  onClose: () => void;
  onCreate: (character: Character) => void;
};

export default function CreateAvatarModal({ onClose, onCreate }: Props) {
  const [name, setName] = useState("");
  const [skillId, setSkillId] = useState(SKILL_PRESETS[0]?.id ?? "engineering");
  const [color, setColor] = useState(AVATAR_COLORS[0] ?? "#4ECDC4");
  const nameRef = useRef<HTMLInputElement>(null);

  const selectedSkill = useMemo(
    () => SKILL_PRESETS.find((skill) => skill.id === skillId) ?? SKILL_PRESETS[0],
    [skillId],
  );
  const previewName = name.trim() || `${selectedSkill?.label ?? "Custom"} Agent`;

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
    onCreate(createCustomCharacter({ name: previewName, skillId, color }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-avatar-title"
        className="w-full max-w-lg rounded-2xl border border-stone-700 bg-stone-950 p-5 shadow-2xl shadow-black/60"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl text-sm font-black text-stone-950 shadow-lg"
            style={{ backgroundColor: color, boxShadow: `0 0 28px ${color}55` }}
          >
            {previewName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 id="create-avatar-title" className="text-sm font-bold text-stone-100">
              Create Avatar
            </h2>
            <p className="text-xs text-stone-400">Choose a skill, role name, and accent color.</p>
          </div>
        </div>

        <label className="mb-4 block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-400">
            Name
          </span>
          <input
            ref={nameRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={`${selectedSkill?.label ?? "Custom"} Agent`}
            className="w-full rounded-lg border border-stone-700 bg-stone-900 p-2.5 text-sm text-stone-100 placeholder:text-stone-600 focus:outline-none"
            style={{ caretColor: color }}
          />
        </label>

        <div className="mb-4">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-400">
            Skill
          </div>
          <div className="grid grid-cols-2 gap-2">
            {SKILL_PRESETS.map((skill) => {
              const selected = skill.id === skillId;
              return (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => setSkillId(skill.id)}
                  className="rounded-lg border p-3 text-left transition hover:-translate-y-0.5"
                  style={{
                    borderColor: selected ? color : "rgb(68 64 60)",
                    background: selected ? `${color}18` : "rgb(28 25 23)",
                  }}
                >
                  <div className="text-xs font-bold text-stone-100">{skill.label}</div>
                  <div className="mt-1 text-[11px] leading-snug text-stone-400">{skill.shortBio}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-5">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-400">
            Color
          </div>
          <div className="flex flex-wrap gap-2">
            {AVATAR_COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`Use color ${swatch}`}
                onClick={() => setColor(swatch)}
                className="h-8 w-8 rounded-lg border-2"
                style={{
                  backgroundColor: swatch,
                  borderColor: swatch === color ? "#f5f5f4" : "transparent",
                }}
              />
            ))}
          </div>
        </div>

        <div className="mb-5 rounded-xl border border-stone-800 bg-stone-900/70 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
            Prompt Preview
          </div>
          <p className="mt-1 text-xs leading-relaxed text-stone-300">
            {previewName} focuses on {selectedSkill?.promptFocus}.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-stone-700 px-3 py-2 text-xs font-semibold text-stone-300 hover:bg-stone-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className="rounded-lg px-3 py-2 text-xs font-black text-stone-950"
            style={{ backgroundColor: color }}
          >
            Create Avatar
          </button>
        </div>
      </div>
    </div>
  );
}
