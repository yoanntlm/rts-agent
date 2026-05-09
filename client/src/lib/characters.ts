// Loads character preset markdown files from /characters at the repo root.
// Frontmatter is parsed for the roster card; the body is the agent's system prompt.

const RAW = import.meta.glob("../../../characters/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

export type Character = {
  id: string;
  name: string;
  icon: string;
  color: string;
  shortBio: string;
  systemPrompt: string;
  skill?: string;
  custom?: boolean;
};

function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data: Record<string, string> = {};
  const fmBlock = m[1] ?? "";
  for (const line of fmBlock.split(/\r?\n/)) {
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

export const CHARACTERS: Character[] = Object.entries(RAW)
  .map(([path, raw]) => {
    const { data, body } = parseFrontmatter(raw);
    const id = data.id ?? path.split("/").pop()!.replace(/\.md$/, "");
    return {
      id,
      name: data.name ?? id,
      icon: data.icon ?? "",
      color: data.color ?? "#9ca3af",
      shortBio: data.shortBio ?? "",
      systemPrompt: body.trim(),
    } satisfies Character;
  })
  .sort((a, b) => a.name.localeCompare(b.name));

export function getCharacter(id: string): Character | undefined {
  return CHARACTERS.find((c) => c.id === id);
}
