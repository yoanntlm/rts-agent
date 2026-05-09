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
    id: "coding",
    label: "Coding Specialist",
    shortBio: "Feature work, refactors, bug fixes",
    promptFocus: "writing, editing, and debugging code in an existing repository",
  },
  {
    id: "design",
    label: "Design",
    shortBio: "Product UX, UI polish, interaction design",
    promptFocus: "user experience, visual polish, interaction design, and product clarity",
  },
  {
    id: "data",
    label: "Data",
    shortBio: "Analysis, metrics, data pipelines",
    promptFocus: "data analysis, data modeling, metrics, and pipeline reliability",
  },
  {
    id: "infrastructure",
    label: "Infrastructure",
    shortBio: "Deploys, CI, env, reliability",
    promptFocus: "deployment, CI/CD, infrastructure reliability, and environment configuration",
  },
  {
    id: "testing",
    label: "Testing",
    shortBio: "QA, repros, regression coverage",
    promptFocus: "testing strategy, regression coverage, reproductions, and quality gates",
  },
  {
    id: "security",
    label: "Security",
    shortBio: "Threat modeling, auth, secrets",
    promptFocus: "security review, authentication, authorization, secret hygiene, and threat modeling",
  },
  {
    id: "product",
    label: "Product",
    shortBio: "Specs, prioritization, acceptance criteria",
    promptFocus: "product requirements, prioritization, acceptance criteria, and user outcomes",
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
  const name = input.name.trim() || skill.label;

  return {
    id: `custom-${skill.id}-${Date.now()}`,
    name,
    icon: "",
    color: input.color,
    skill: skill.id,
    custom: true,
    shortBio: skill.shortBio,
    systemPrompt: [
      `You are ${name}, a ${skill.label.toLowerCase()} teammate.`,
      `You specialize in ${skill.promptFocus}.`,
      "Work like a senior member of the team: read context first, explain important tradeoffs, and produce focused, reviewable changes.",
    ].join("\n"),
  };
}

export function loadCustomCharacters(): Character[] {
  try {
    const raw = window.localStorage.getItem(CUSTOM_CHARACTER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCharacter);
  } catch {
    return [];
  }
}

export function saveCustomCharacters(characters: Character[]) {
  window.localStorage.setItem(CUSTOM_CHARACTER_STORAGE_KEY, JSON.stringify(characters));
}

function isCharacter(value: unknown): value is Character {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Character>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.color === "string" &&
    typeof candidate.shortBio === "string" &&
    typeof candidate.systemPrompt === "string"
  );
}
