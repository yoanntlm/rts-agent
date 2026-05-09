// Avatar generator for the agent presets.
//
// Reads /characters/*.md frontmatter (id/name/color/shortBio), builds a
// per-role Singapore-pixel-art Stardew-NPC prompt, and writes one PNG per
// character to /client/public/assets/chars/<id>.png — the path the roster
// cards already point at via the `icon` field in each character file.
//
// Run with:
//   pnpm assets:avatars                  # anything missing
//   pnpm assets:avatars -- --force       # re-roll everything
//   pnpm assets:avatars -- --only=frontend,tester

import "dotenv/config";
import { writeFile, mkdir, access, readFile, readdir } from "node:fs/promises";
import { constants as FS } from "node:fs";
import { join, resolve } from "node:path";
import OpenAI from "openai";
import {
  AVATAR_IMAGE_MODEL,
  AVATAR_IMAGE_QUALITY,
  AVATAR_IMAGE_SIZE,
  buildAvatarPrompt,
} from "../../client/src/lib/avatarPrompt";

const CHARACTERS_DIR = resolve(process.cwd(), "..", "characters");
const OUT_DIR = resolve(process.cwd(), "..", "client", "public", "assets", "chars");

// gpt-image-2 doesn't support `background: transparent`; this project doesn't
// have access to gpt-image-1 (which does). Workaround: prompt for a solid
// white background and chroma-key client-side later if we need transparency.
// Override via IMAGE_MODEL env var if access changes.
const MODEL = process.env.IMAGE_MODEL ?? AVATAR_IMAGE_MODEL;
const SIZE = AVATAR_IMAGE_SIZE;
const QUALITY = AVATAR_IMAGE_QUALITY;
const CONCURRENCY = 3;

// ---------- Frontmatter parsing ----------------------------------------------

type Character = { id: string; name: string; color: string; shortBio: string };

function parseFrontmatter(md: string): Record<string, string> {
  const m = /^---\n([\s\S]*?)\n---/.exec(md);
  if (!m || !m[1]) return {};
  const out: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const eq = line.indexOf(":");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

async function loadCharacters(): Promise<Character[]> {
  const files = (await readdir(CHARACTERS_DIR)).filter((f) => f.endsWith(".md"));
  const out: Character[] = [];
  for (const f of files) {
    const md = await readFile(join(CHARACTERS_DIR, f), "utf8");
    const fm = parseFrontmatter(md);
    const id = fm.id;
    const name = fm.name;
    const color = fm.color;
    const shortBio = fm.shortBio ?? "";
    if (!id || !name || !color) {
      console.warn(`[${f}] missing id/name/color in frontmatter — skipped`);
      continue;
    }
    out.push({ id, name, color, shortBio });
  }
  return out;
}

function buildPrompt(c: Character): string {
  return buildAvatarPrompt({
    id: c.id,
    title: c.name,
    color: c.color,
    shortBio: c.shortBio,
  });
}

// ---------- CLI args ----------------------------------------------------------

function parseArgs(argv: string[]) {
  const args = new Set(argv.slice(2));
  const onlyArg = [...args].find((a) => a.startsWith("--only="));
  const only = onlyArg ? new Set(onlyArg.slice("--only=".length).split(",")) : null;
  return {
    force: args.has("--force"),
    only,
  };
}

// ---------- Generation --------------------------------------------------------

async function fileExists(path: string) {
  try {
    await access(path, FS.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function generateOne(
  openai: OpenAI,
  character: Character,
  outDir: string,
): Promise<{ id: string; status: "wrote" | "failed"; reason?: string }> {
  const outPath = join(outDir, `${character.id}.png`);
  const promptPath = join(outDir, `${character.id}.prompt.txt`);
  const prompt = buildPrompt(character);

  console.log(`[${character.id}] generating…`);
  try {
    const res = await openai.images.generate({
      model: MODEL,
      prompt,
      size: SIZE,
      quality: QUALITY,
      // Note: gpt-image-2 doesn't support `background: transparent`. The
      // prompt asks for a flat white background; chroma-key later if needed.
      n: 1,
    } as Parameters<typeof openai.images.generate>[0]);

    const b64 = res.data?.[0]?.b64_json;
    if (!b64) {
      return { id: character.id, status: "failed", reason: "no b64 in response" };
    }
    await writeFile(outPath, Buffer.from(b64, "base64"));
    await writeFile(promptPath, prompt + "\n");
    console.log(`[${character.id}] → ${outPath}`);
    return { id: character.id, status: "wrote" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[${character.id}] FAILED: ${msg}`);
    return { id: character.id, status: "failed", reason: msg };
  }
}

async function runBatch<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  const lanes = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      const item = items[idx]!;
      results[idx] = await worker(item);
    }
  });
  await Promise.all(lanes);
  return results;
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY not set. Copy .env.example to .env and fill it in.");
    process.exit(1);
  }
  const { force, only } = parseArgs(process.argv);
  await mkdir(OUT_DIR, { recursive: true });
  const openai = new OpenAI();

  const characters = await loadCharacters();
  if (characters.length === 0) {
    console.error(`No character files found in ${CHARACTERS_DIR}.`);
    process.exit(1);
  }

  const candidates = characters.filter((c) => (only ? only.has(c.id) : true));
  const queued: Character[] = [];
  for (const c of candidates) {
    const exists = await fileExists(join(OUT_DIR, `${c.id}.png`));
    if (exists && !force) {
      console.log(`[${c.id}] skip (exists — pass --force to re-roll)`);
      continue;
    }
    queued.push(c);
  }

  if (queued.length === 0) {
    console.log("nothing to generate.");
    return;
  }

  console.log(
    `generating ${queued.length} avatar(s) with ${MODEL} @ ${SIZE} ${QUALITY}, concurrency=${CONCURRENCY}\n`,
  );
  const results = await runBatch(
    queued,
    (c) => generateOne(openai, c, OUT_DIR),
    CONCURRENCY,
  );

  const wrote = results.filter((r) => r.status === "wrote").length;
  const failed = results.filter((r) => r.status === "failed");
  console.log(`\ndone. wrote=${wrote} failed=${failed.length}`);
  if (failed.length > 0) {
    for (const f of failed) console.log(`  - ${f.id}: ${f.reason ?? "?"}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
