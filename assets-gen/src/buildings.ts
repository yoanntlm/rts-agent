// Buildings / multi-tile assets generator.
//
// Generates non-tile world objects that span more than one tile cell —
// construction zones, hawker centres, HDB blocks, etc. — and writes them
// into client/public/assets/buildings/<name>-<WxH>.png.
//
// Filename convention: `<name>-<footprintW>x<footprintH>.png` so the
// footprint is discoverable from disk without a sidecar.
//
// Run with:
//   pnpm assets:buildings                       # anything missing
//   pnpm assets:buildings -- --force            # re-roll everything
//   pnpm assets:buildings -- --only=construction-zone

import "dotenv/config";
import { writeFile, mkdir, access } from "node:fs/promises";
import { constants as FS } from "node:fs";
import { join, resolve } from "node:path";
import OpenAI from "openai";

const OUT_DIR = resolve(
  process.cwd(),
  "..",
  "client",
  "public",
  "assets",
  "buildings",
);

const MODEL = process.env.IMAGE_MODEL ?? "gpt-image-2";
const QUALITY: "high" = "high";
const CONCURRENCY = 3;

// ---------- Style preamble ----------------------------------------------------
//
// Same Stardew-Valley pixel-art Singapore direction as the tile set and
// avatars — keeps the visual language coherent across all asset categories.

const BUILDING_STYLE = `
COZY PIXEL-ART MULTI-TILE BUILDING / WORLD OBJECT — MODERN TROPICAL
SINGAPORE CITY-BUILDER.

Style technique: Stardew Valley pixel-art technique, hand-painted, gentle
dithering, visible pixel grain but not chunky, soft outlines on shapes,
no harsh black strokes.

Subject: a real world object you'd see in modern tropical Singapore —
NOT medieval, NOT fantasy. Match the same world as our park grass,
hawker tile, HDB void-deck pavers, Marina Bay water, and the agent NPC
sprites.

Perspective: top-down 3/4 OBLIQUE view (the Stardew angle). The ground
is mostly seen from above; vertical structures (cranes, walls, roofs)
extend slightly upward and forward so they read as having height. NOT
strict isometric, NOT side-view — this matches our other assets.

Palette: same warm tropical Singapore palette as the rest of the set —
park green #58a13a, paver beige #c8b89a, asphalt grey #4a4a44, hawker
cream #f0e8d6, terracotta #b04a2a, marina turquoise #4ec5c0, ochre
dirt #a8743a. Bright equatorial midday light. NOT evening, NOT
golden-hour, NOT moody.

Output rules:
- No frame, no border, no signature, no grid lines, no watermark.
- No floating UI overlays, no labels, no name tags.
- No characters/people (the agent sprites are added separately by the
  game world; people inside buildings or sites would clash).
- Even, ambient lighting — no dramatic single-direction sun shadow
  across the whole image.

EXPLICITLY AVOID: medieval, fantasy, samurai, photorealistic, modern
glass-skyscraper Marina Bay Sands styling (unless explicitly prompted),
sky / clouds visible (we are top-down, the camera does not see sky),
gradient backgrounds, decorative borders.

Building content:
`.trim();

// ---------- Targets -----------------------------------------------------------

type Size = "1024x1024" | "1024x1536" | "1536x1024";

type Target = {
  /** filename slug — used for the PNG and the prompt sidecar. */
  name: string;
  /** appended to BUILDING_STYLE — describes this specific building. */
  body: string;
  /** matches the rough aspect of the building's sprite (footprint plus any height). */
  size: Size;
  /** how many tile cells this building occupies on the ground. */
  footprint: { w: number; h: number };
};

const BUILDINGS: Target[] = [
  {
    name: "construction-zone",
    size: "1024x1024",
    footprint: { w: 3, h: 3 },
    body: `
A SINGAPORE CONSTRUCTION SITE / BUILD LOT, 3 tiles wide × 3 tiles
deep, FILLING THE ENTIRE 1024x1024 FRAME edge to edge. The whole
patch reads "do not enter — work in progress" — cordoned off from
the surrounding city by Singapore-style construction hoarding.

Composition, top-down with slight 3/4 oblique:
- PERIMETER: continuous waist-high BLUE-AND-WHITE corrugated metal
  hoarding fence runs the full perimeter of the frame (all four
  sides). The fence has yellow-and-black warning stripes painted
  along the top edge. This is the iconic hoarding around any new
  HDB or condo build in Singapore. The fence touches the four edges
  of the 1024x1024 image — there is NO white margin or city
  bleeding in from outside.
- GROUND inside the fence: bare warm OCHRE CONSTRUCTION DIRT
  (#a8743a base, #6f4a22 ruts, #c89a5a highlights), with subtle
  tire-track impressions and small gravel patches.
- ONE small SINGAPORE-STYLE YELLOW TOWER CRANE in the rear-left
  corner of the site, its tower visible standing upright (3/4
  oblique), with red-and-white stripes near the top of the tower
  and a horizontal jib arm reaching across part of the site. Crane
  occupies roughly 1/4 of the tile in footprint.
- ONE compact YELLOW-AND-ORANGE CATERPILLAR-STYLE EXCAVATOR (with
  tracks, articulated arm, and bucket) parked near the center of
  the site, visible from above with the arm folded.
- TWO or THREE small MATERIAL PILES scattered asymmetrically:
  coiled rebar bundles, a stack of bricks, a pile of sandbags, or
  rolled construction mesh.
- A pair of ORANGE-AND-WHITE TRAFFIC CONES near a gap in the fence
  (where a worker entrance would be) on one side.
- A small portable yellow triangle WARNING SIGN, no readable text.
- NO completed building, NO finished foundations, NO concrete pour
  yet — this is the bare lot just after demolition / before vertical
  construction starts.

Palette: ochre dirt (#a8743a / #6f4a22 / #c89a5a), crane yellow
#f0b830, safety orange #d97830, hoarding blue #2a78b8, hoarding
white #e8e0d0, machine dark grey #3a3a36, warning yellow-black
stripe pattern.

Output rules: the construction site fills the entire frame edge to
edge. There is NO transparent background and NO white margin
around the site — the perimeter fence IS the visual edge of the
image.

EXPLICITLY AVOID: a completed building inside the fence, sky
visible, surrounding city tiles visible (the fence cuts off the
view), workers / people / hard-hats (no characters), photorealistic
machinery, brand logos, readable text on signs.
`.trim(),
  },
];

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

function filenameFor(t: Target) {
  return `${t.name}-${t.footprint.w}x${t.footprint.h}.png`;
}

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
  target: Target,
  outDir: string,
): Promise<{ name: string; status: "wrote" | "failed"; reason?: string }> {
  const file = filenameFor(target);
  const outPath = join(outDir, file);
  const promptPath = join(outDir, file.replace(/\.png$/, ".prompt.txt"));
  const prompt = `${BUILDING_STYLE}\n${target.body}`;

  console.log(`[${target.name}] generating @ ${target.size} (${target.footprint.w}×${target.footprint.h} tiles)…`);
  try {
    const res = await openai.images.generate({
      model: MODEL,
      prompt,
      size: target.size,
      quality: QUALITY,
      n: 1,
    } as Parameters<typeof openai.images.generate>[0]);

    const b64 = res.data?.[0]?.b64_json;
    if (!b64) {
      return { name: target.name, status: "failed", reason: "no b64 in response" };
    }
    await writeFile(outPath, Buffer.from(b64, "base64"));
    await writeFile(promptPath, prompt + "\n");
    console.log(`[${target.name}] → ${outPath}`);
    return { name: target.name, status: "wrote" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[${target.name}] FAILED: ${msg}`);
    return { name: target.name, status: "failed", reason: msg };
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

  const candidates = BUILDINGS.filter((t) => (only ? only.has(t.name) : true));
  const queued: Target[] = [];
  for (const t of candidates) {
    const exists = await fileExists(join(OUT_DIR, filenameFor(t)));
    if (exists && !force) {
      console.log(`[${t.name}] skip (exists — pass --force to re-roll)`);
      continue;
    }
    queued.push(t);
  }

  if (queued.length === 0) {
    console.log("nothing to generate.");
    return;
  }

  console.log(
    `generating ${queued.length} building(s) with ${MODEL} ${QUALITY}, concurrency=${CONCURRENCY}\n`,
  );
  const results = await runBatch(
    queued,
    (t) => generateOne(openai, t, OUT_DIR),
    CONCURRENCY,
  );

  const wrote = results.filter((r) => r.status === "wrote").length;
  const failed = results.filter((r) => r.status === "failed");
  console.log(`\ndone. wrote=${wrote} failed=${failed.length}`);
  if (failed.length > 0) {
    for (const f of failed) console.log(`  - ${f.name}: ${f.reason ?? "?"}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
