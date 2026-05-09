import type { Character } from "./characters";

export type SkillPreset = {
  id: string;
  label: string;
  shortBio: string;
  promptFocus: string;
};

export type CustomCharacterInput = {
  name: string;
  skillId: string;
  color: string;
};

export const CUSTOM_CHARACTER_STORAGE_KEY = "rts-agent.customCharacters.v1";

export const SKILL_PRESETS: SkillPreset[] = [
  {
    id: "engineering",
    label: "Engineering",
    shortBio: "Systems, architecture, implementation",
    promptFocus: "software architecture, implementation tradeoffs, and production-quality code",
  },
  {
    id: "design",
    label: "Design",
    shortBio: "Product UX, UI polish, interaction design",
    promptFocus: "product UX, visual hierarchy, accessibility, and interaction details",
  },
  {
    id: "testing",
    label: "Testing",
    shortBio: "Repros, coverage, regression checks",
    promptFocus: "bug reproduction, regression testing, and clear verification plans",
  },
  {
    id: "ops",
    label: "Ops",
    shortBio: "Deploys, CI, infrastructure debugging",
    promptFocus: "deployment, CI, observability, and operational reliability",
  },
];

export const AVATAR_COLORS = [
  "#4ECDC4",
  "#FFD166",
  "#EF476F",
  "#A78BFA",
  "#06D6A0",
  "#38BDF8",
  "#F97316",
  "#F472B6",
];

export function createCustomCharacter(input: CustomCharacterInput): Character {
  const skill = SKILL_PRESETS.find((preset) => preset.id === input.skillId) ?? SKILL_PRESETS[0]!;
  const name = input.name.trim() || `${skill.label} Agent`;
  const idBase = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const id = `custom-${idBase || skill.id}-${Date.now().toString(36)}`;

  return {
    id,
    name,
    icon: "",
    color: input.color,
    shortBio: skill.shortBio,
    skill: skill.label,
    custom: true,
    systemPrompt: `You are ${name}, a specialist focused on ${skill.promptFocus}. Work clearly, communicate progress, and match the existing project style.`,
  };
}

export function loadCustomCharacters(): Character[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_CHARACTER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isCharacter) : [];
  } catch {
    return [];
  }
}

export function saveCustomCharacters(characters: Character[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CUSTOM_CHARACTER_STORAGE_KEY, JSON.stringify(characters));
}

function isCharacter(value: unknown): value is Character {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Record<keyof Character, unknown>>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.color === "string" &&
    typeof candidate.shortBio === "string" &&
    typeof candidate.systemPrompt === "string"
  );
}
