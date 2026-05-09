// Asset generator for rts-agent.
//
// Generates a coherent, hand-crafted-looking asset set via gpt-image-2 and
// writes results into client/public/assets/generated/.
//
// Tile-set theme: MODERN TROPICAL SINGAPORE city-builder base layer.
// Stardew-Valley pixel-art technique, but the SUBJECT is Singapore — HDB
// parks, hawker centres, Marina Bay, zebra crossings, shophouse pavers —
// NOT medieval/fantasy.
//
// Usage:
//   pnpm assets:gen                     # generate anything missing
//   pnpm assets:gen -- --force          # re-roll everything
//   pnpm assets:gen -- --only=a,b       # re-roll a subset by name

import "dotenv/config";
import { writeFile, mkdir, access } from "node:fs/promises";
import { constants as FS } from "node:fs";
import { join } from "node:path";
import OpenAI from "openai";

const OUT_DIR = join(process.cwd(), "..", "client", "public", "assets", "generated");

const MODEL = process.env.IMAGE_MODEL ?? "gpt-image-2";
const SIZE: "1024x1024" = "1024x1024";
const QUALITY: "high" = "high";
const CONCURRENCY = 3;

// ---------- Style preamble ----------------------------------------------------
//
// Prepended to every tile prompt. Goal: lock palette, perspective, and render
// style so the set is visually coherent. Uses concrete real-world anchors
// (Stardew Valley for technique, Singapore landmarks for subject) rather than
// vague style words.

const TILE_STYLE = `
COZY PIXEL-ART TILE — MODERN TROPICAL SINGAPORE CITY BASE LAYER.

Style technique: Stardew Valley pixel-art texture and palette saturation.
Hand-painted feel, gentle dithering, no harsh outlines on the tile body.
Pixel grain visible but not chunky — feels hand-drawn at this resolution.

Subject: modern tropical Singapore — NOT medieval, NOT fantasy. Concrete
references the painter is drawing from: Singapore Botanic Gardens, HDB
void-deck parks, Tiong Bahru shophouse five-foot-ways, Marina Bay
waterfront, hawker centres, Orchard Road interlocking pavers, zebra
crossings outside MRT stations. Bright equatorial midday light, lush
vegetation, urban order.

Perspective: strict top-down, 90° from above, no parallax, no perspective
foreshortening. Tile is flat as if seen from directly overhead.

Palette (vibrant, midday tropical):
- Park green: deep #2c5b1e, mid #58a13a, highlight #9bd25c.
- Concrete paver: warm beige #c8b89a, shadow #8a7c64, highlight #e8dcc1.
- Asphalt road: warm grey #4a4a44, highlight #6e6e66; markings white
  #f5f0d8 and yellow #d8b830.
- Terracotta clay / red brick: warm red #b04a2a, shadow #6f2a16, highlight
  #d97a52.
- Hawker tile cream: #f0e8d6, with terracotta accent #c25a36.
- Marina water turquoise: surface #4ec5c0, deep #1a7a82, highlight #a8e8e0.

Output rules:
- Single SQUARE tile filling the full 1024x1024 frame, edge-to-edge.
- No frame, no border, no drop shadow, no signature, no grid lines, and
  NO text unless the prompt explicitly asks for road markings.
- Designed to TILE seamlessly: features stay inside the tile body, no
  half-cut features at the edges.
- Even, ambient lighting — no directional shadow falling across the tile.

EXPLICITLY AVOID: medieval cobblestone, mossy stones, fantasy elements,
JRPG forest, Pokemon-style cartoon overworld, dungeon textures, walnut
wood floors, evening light, pirate maps.

Tile content:
`.trim();

// ---------- Targets -----------------------------------------------------------

type Target = {
  name: string;
  /** Body of the prompt — appended to TILE_STYLE. */
  body: string;
  /** Sprites/props will set this to "transparent". Terrain stays opaque. */
  background?: "opaque" | "transparent";
};

const TILES: Target[] = [
  // ---------- Park / nature ----------
  {
    name: "park-grass",
    body: `
A plain patch of healthy short manicured park grass — the kind underfoot
in HDB void-deck parks or on the Padang lawn. Bright tropical green, even
uniform texture. No flowers, no creatures, no path. This is the BASE tile,
used for ~70% of the map, so it must read calm and quiet.
`.trim(),
  },
  {
    name: "park-grass-orchid",
    body: `
Manicured park grass with three or four tiny pale-purple Vanda Miss
Joaquim orchid sprigs (Singapore's national flower) scattered
asymmetrically inside the tile body, well clear of the edges. Each sprig
small, around 1/15th of the tile. Used as a 15% scatter variant — accents
without dominating.
`.trim(),
  },
  {
    name: "park-grass-hibiscus",
    body: `
Manicured park grass with two small hibiscus blooms — one red, one yellow
— and three or four short fern fronds, placed asymmetrically inside the
tile body. Each flower around 1/12th of the tile. Used as a 15% scatter
variant.
`.trim(),
  },
  {
    name: "park-grass-rooster",
    body: `
Manicured park grass with a single red junglefowl — a wild rooster — in
the center-left of the tile. Dark feathers, vivid red comb, orange-tan
flight feathers. These wild fowl genuinely roam Bishan and Sin Ming
neighborhoods. Whimsical delight tile, used very rarely (~1% of map).
The bird is small but legible from above.
`.trim(),
  },
  {
    name: "park-grass-mynah",
    body: `
Manicured park grass with a single common mynah bird mid-tile: dark brown
body, yellow eye-mask and bill, white wing-tips. Singapore's most common
urban bird. Whimsical delight tile.
`.trim(),
  },
  {
    name: "park-grass-mango",
    body: `
Manicured park grass with a single ripe yellow-orange mango fallen
mid-tile, surrounded by two or three loose green leaves. References the
mango trees lining HDB estates. Whimsical delight tile.
`.trim(),
  },
  {
    name: "tropical-foliage",
    body: `
Densely planted tropical greenery filling the entire tile: ferns,
monstera leaves, broad palm fronds layered together — no exposed grass
underneath. The lush border vegetation seen at MacRitchie reservoir or
East Coast Park edges. Multiple shades of green, deep shadows under the
leaves. Used to mark park borders and undeveloped lush areas.
`.trim(),
  },
  {
    name: "lalang-grass",
    body: `
Tall wild lalang (cogon) grass filling the tile, untamed and slightly
yellow-tipped, with a few feathery flowering plumes. The kind of grass
on undeveloped Singapore lots before construction begins. Movement
implied in the brush strokes — wind-swayed.
`.trim(),
  },

  // ---------- Walkways ----------
  {
    name: "paver-beige",
    body: `
Warm-beige interlocking concrete paver in the I-shaped Holland-bond
pattern seen on Orchard Road and HDB walkways. Each paver about 1/5 of
the tile, with subtle darker grout lines between them. Slightly
weathered. Default sidewalk tile.
`.trim(),
  },
  {
    name: "paver-red-brick",
    body: `
Red-clay brick paver in herringbone pattern, the kind used at Tiong
Bahru shophouse five-foot-ways and Chinatown alleys. Warm terracotta
tones with subtle wear, narrow darker grout lines. Bricks staggered, not
aligned in a grid.
`.trim(),
  },
  {
    name: "void-deck-tile",
    body: `
HDB void-deck floor: a 4x4 grid of square red-and-cream terrazzo tiles,
some red, some cream, alternating in a calm checker-like pattern but
not perfectly regular. Slightly worn, smooth, the iconic ground-floor
common-area floor of Singapore public housing.
`.trim(),
  },

  // ---------- Streets ----------
  {
    name: "road-asphalt",
    body: `
Plain dark warm-grey asphalt road surface, slightly textured with fine
aggregate, no road markings, no curbs. Default road tile that fills under
roads and intersections.
`.trim(),
  },
  {
    name: "road-center-line",
    body: `
Dark asphalt road with two parallel WHITE dashed center stripes running
horizontally across the tile (left edge to right edge), evenly spaced,
exactly the markings that would tile horizontally to form a continuous
two-lane road. No other markings, no curbs, no text.
`.trim(),
  },
  {
    name: "road-zebra",
    body: `
Dark asphalt road with five wide WHITE zebra-crossing stripes running
vertically across the tile (top edge to bottom edge), evenly spaced —
the unmistakable Singapore zebra pedestrian crossing seen outside MRT
stations. No other markings, no text. Designed to tile horizontally.
`.trim(),
  },
  {
    name: "road-bus-lane",
    body: `
Asphalt road with the surface painted iconic Singapore bus-lane TERRACOTTA
RED (warm red, slightly faded), with a single white forward arrow marking
in the center of the tile. The painted-red asphalt under SBS bus lanes.
No text.
`.trim(),
  },

  // ---------- Civic floor ----------
  {
    name: "hawker-tile",
    body: `
Hawker-centre / kopitiam ceramic floor: a 4x4 grid of square cream tiles
with terracotta-colored grout lines. Slightly stained and lived-in, the
warmth of food-service flooring. The classic Singapore hawker floor seen
at Maxwell, Chinatown Complex, Old Airport Road.
`.trim(),
  },
  {
    name: "kopitiam-tile",
    body: `
Old Singapore coffeeshop floor: a geometric pattern of pale-green and
cream square tiles laid in a 1980s diamond-and-square motif, slightly
nostalgic and worn. The kind of floor in a heritage Tiong Bahru kopitiam.
`.trim(),
  },

  // ---------- Water ----------
  {
    name: "marina-water",
    body: `
Calm Marina Bay water — bright turquoise base with three or four pale
ripple arcs catching the equatorial sun. More saturated and brighter
than a forest pond. Hand-painted, not photoreal. No reflections of
buildings, no foam. Designed to tile seamlessly across a large bay.
`.trim(),
  },
  {
    name: "monsoon-drain",
    body: `
Singapore monsoon drain seen from above: a beige concrete channel
running vertically through the center of the tile, with shallow muddy
water at the bottom of the channel. Concrete sides ribbed with darker
horizontal safety lines. Designed to tile vertically as a continuous
drain. No grass on the sides — the drain occupies most of the tile.
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
  preamble: string,
  outDir: string,
): Promise<{ name: string; status: "wrote" | "skipped" | "failed"; reason?: string }> {
  const outPath = join(outDir, `${target.name}.png`);
  const promptPath = join(outDir, `${target.name}.prompt.txt`);
  const fullPrompt = `${preamble}\n${target.body}`;

  console.log(`[${target.name}] generating…`);
  try {
    const res = await openai.images.generate({
      model: MODEL,
      prompt: fullPrompt,
      size: SIZE,
      quality: QUALITY,
      background: target.background ?? "opaque",
      n: 1,
    } as Parameters<typeof openai.images.generate>[0]);

    const b64 = res.data?.[0]?.b64_json;
    if (!b64) {
      return { name: target.name, status: "failed", reason: "no b64 in response" };
    }
    await writeFile(outPath, Buffer.from(b64, "base64"));
    await writeFile(promptPath, fullPrompt + "\n");
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

  // Filter by --only and --force/skip-existing.
  const candidates = TILES.filter((t) => (only ? only.has(t.name) : true));
  const queued: Target[] = [];
  for (const t of candidates) {
    const exists = await fileExists(join(OUT_DIR, `${t.name}.png`));
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
    `generating ${queued.length} asset(s) with ${MODEL} @ ${SIZE} ${QUALITY}, concurrency=${CONCURRENCY}\n`,
  );
  const results = await runBatch(
    queued,
    (t) => generateOne(openai, t, TILE_STYLE, OUT_DIR),
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
