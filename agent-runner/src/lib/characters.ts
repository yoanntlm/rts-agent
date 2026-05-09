// Loads character preset markdown files from /characters at the repo root.
// Mirrors client/src/lib/characters.ts but uses Node fs (no Vite import.meta.glob).

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// agent-runner/src/lib → ../.. → agent-runner → .. → repo root → /characters
const CHAR_DIR = join(__dirname, "..", "..", "..", "characters");

export type Character = {
  id: string;
  name: string;
  systemPrompt: string;
};

function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data: Record<string, string> = {};
  for (const line of (m[1] ?? "").split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    let v = line.slice(idx + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    data[k] = v;
  }
  return { data, body: m[2] ?? "" };
}

const CHARACTERS = new Map<string, Character>();
for (const file of readdirSync(CHAR_DIR)) {
  if (!file.endsWith(".md")) continue;
  const raw = readFileSync(join(CHAR_DIR, file), "utf-8");
  const { data, body } = parseFrontmatter(raw);
  const id = data.id ?? file.replace(/\.md$/, "");
  CHARACTERS.set(id, {
    id,
    name: data.name ?? id,
    systemPrompt: body.trim(),
  });
}

export function getCharacter(id: string): Character | undefined {
  return CHARACTERS.get(id);
}

export function listCharacters(): Character[] {
  return [...CHARACTERS.values()];
}
