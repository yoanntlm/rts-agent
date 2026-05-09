// Sprite-sheet animator for buildings.
//
// For fully stable loops, frames must not ask the image model to redraw the
// whole scene independently. The construction-site animation therefore uses a
// locked-base renderer: every frame starts from the exact source PNG pixels and
// only composites deterministic dust / beacon effects on top. The older
// image-edit path is still available for future animations where a little
// redraw drift is acceptable.
//
// Output layout:
//   client/public/assets/buildings/animations/<name>/
//     frame-01.png ... frame-NN.png
//     sheet.png    (horizontal strip, frames left-to-right)
//     meta.json
//
// Run with:
//   pnpm assets:animate-building
//   pnpm assets:animate-building -- --only=construction-zone-3x3 --force

import "dotenv/config";
import sharp from "sharp";
import OpenAI from "openai";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { constants as FS } from "node:fs";
import { join, resolve, dirname } from "node:path";

const BUILDINGS_DIR = resolve(
  process.cwd(),
  "..",
  "client",
  "public",
  "assets",
  "buildings",
);
const ANIMATIONS_DIR = join(BUILDINGS_DIR, "animations");

const MODEL = process.env.IMAGE_MODEL ?? "gpt-image-2";
const QUALITY: "high" = "high";
const SIZE: "1024x1024" = "1024x1024";
const CONCURRENCY = 3;

// ---------- Frame instruction shared preamble --------------------------------
//
// Every frame prompt prepends this so the model gets the "preserve almost
// everything" message loud and clear.

function framePreamble(frameIndex: number, totalFrames: number, name: string) {
  return `
This is FRAME ${frameIndex} of ${totalFrames} in a looping animation of a
"${name}" — a Singapore HDB-style construction site rendered in cozy
pixel-art Stardew Valley style. The reference image you've been given is
the canonical scene.

KEEP EXACTLY IDENTICAL to the reference image:
- The blue-and-white corrugated hoarding fence around the entire perimeter
  (with yellow-and-black warning stripes along the top edge).
- The ochre construction-dirt ground texture, including all tire tracks
  and gravel patches.
- The yellow tower crane's TOWER (the upright structure in the upper-left
  corner) and its horizontal jib arm position — the jib does NOT rotate.
- All material piles in their current positions: rebar bundles top-right,
  brick stack right, construction-mesh roll left, sandbag pile bottom-left.
- The two orange traffic cones (bottom center) and the yellow caution sign
  (bottom-right).
- Camera angle, lighting, palette, pixel-art technique, frame composition.
- Image size and aspect ratio.

CHANGE ONLY the following from the reference (this frame's specific motion):
`.trim();
}

const FRAME_OUTPUT_RULES = `
Output rules: same 1024x1024 frame, same composition, edge-to-edge fence.
Do not redesign the scene, do not add new objects beyond the listed
changes, do not move material piles or signs. The animation depends on
everything except the listed changes staying still.

EXPLICITLY AVOID: changing the crane jib direction, moving the material
piles, adding workers/people, changing the perimeter fence pattern,
showing sky, changing the camera angle.
`.trim();

// ---------- Animation config -------------------------------------------------

type Frame = {
  /** filename suffix — `frame-01`, `frame-02`, … */
  id: string;
  /** describes what changes in this frame relative to the reference. */
  body: string;
};

type AnimationMode = "locked-base" | "ai-edit";

type Animation = {
  /** identifier — also the folder name under animations/. */
  name: string;
  /** filename in BUILDINGS_DIR to use as the visual reference. */
  sourceFile: string;
  /** Locked base is pixel-stable; ai-edit can redraw the scene. */
  mode: AnimationMode;
  /** suggested frames-per-second for this loop. */
  fps: number;
  frames: Frame[];
};

const ANIMATIONS: Animation[] = [
  {
    name: "construction-zone-3x3",
    sourceFile: "construction-zone-3x3.png",
    mode: "locked-base",
    fps: 4,
    frames: [
      {
        id: "frame-01",
        body: `
The yellow-and-orange caterpillar excavator's ARM is RAISED with the bucket
held HIGH and folded close to the cab — a "rest" position between digs.
The crane's CABLE HOOK hangs HIGH on a short cable, near the underside of
the jib arm. NO dust visible anywhere on the site.
`.trim(),
      },
      {
        id: "frame-02",
        body: `
The yellow-and-orange caterpillar excavator's ARM is now EXTENDING FORWARD
and DOWNWARD, with the bucket descending toward the dirt. Bucket is
roughly halfway between the cab and the ground. The crane's CABLE HOOK is
LOWER than in the previous frame, hanging on a slightly longer cable.
A SMALL faint dust puff is starting to form near the bucket tip — the
size of a fist.
`.trim(),
      },
      {
        id: "frame-03",
        body: `
The yellow-and-orange caterpillar excavator's BUCKET is TOUCHING THE
GROUND mid-scoop, the arm extended fully forward and down. A VISIBLE
DUST CLOUD surrounds the bucket where it's hitting the dirt — about
twice the size of the bucket itself, soft pale-tan dust. The crane's
CABLE HOOK is at MID-HEIGHT, cable about half-extended.
`.trim(),
      },
      {
        id: "frame-04",
        body: `
The yellow-and-orange caterpillar excavator's BUCKET is now LIFTED back
toward the cab with a SMALL VISIBLE DIRT LOAD heaped inside the bucket
(loose dirt visible above the rim). A LIGHT DUST TRAIL follows behind
the bucket's path. The crane's CABLE HOOK is LOW, cable nearly fully
extended.
`.trim(),
      },
      {
        id: "frame-05",
        body: `
The yellow-and-orange caterpillar excavator has SLIGHTLY ROTATED its
upper cab on the tracks (the tracks themselves stay put), and the arm
is now SWUNG TO ONE SIDE so the bucket hangs over a small dirt pile
on the ground. Bucket still HOLDS a dirt load. A LIGHT dust drift
trails the bucket. The crane's CABLE HOOK is LOW, hook visible at the
end of the long cable.
`.trim(),
      },
      {
        id: "frame-06",
        body: `
The yellow-and-orange caterpillar excavator's BUCKET is DUMPING the
dirt — bucket tilted forward, a small dirt pile forming on the ground
below it. A small IMPACT DUST CLOUD rises where the dirt is landing.
The crane's CABLE HOOK is LIFTING BACK UP, cable about half-extended,
returning toward the jib for the next cycle.
`.trim(),
      },
    ],
  },
];

// ---------- CLI args ---------------------------------------------------------

function parseArgs(argv: string[]) {
  const args = new Set(argv.slice(2));
  const onlyArg = [...args].find((a) => a.startsWith("--only="));
  const only = onlyArg ? new Set(onlyArg.slice("--only=".length).split(",")) : null;
  return {
    force: args.has("--force"),
    only,
  };
}

// ---------- File helpers -----------------------------------------------------

async function fileExists(path: string) {
  try {
    await access(path, FS.F_OK);
    return true;
  } catch {
    return false;
  }
}

// ---------- Frame generation -------------------------------------------------

function lockedBasePrompt(
  animationName: string,
  totalFrames: number,
  frameIndex: number,
  frame: Frame,
) {
  return [
    `Deterministic locked-base frame ${frameIndex}/${totalFrames} for "${animationName}".`,
    "The source building PNG is reused pixel-for-pixel as the base layer.",
    "Only scripted overlay effects are composited above it, so the scene geometry, fence, dirt, machinery, and props stay exactly registered across every frame.",
    "",
    "Effect note:",
    frame.body,
  ].join("\n");
}

function rect(x: number, y: number, w: number, h: number, fill: string, opacity = 1) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" opacity="${opacity.toFixed(2)}"/>`;
}

function constructionOverlaySvg(frameIndex: number) {
  const phases = [
    { dust: 0.05, drift: 0, beacon: 0.4, hook: 0.25 },
    { dust: 0.32, drift: 0, beacon: 0.75, hook: 0.45 },
    { dust: 0.72, drift: 4, beacon: 1, hook: 0.7 },
    { dust: 0.55, drift: 12, beacon: 0.65, hook: 0.5 },
    { dust: 0.36, drift: 22, beacon: 0.35, hook: 0.35 },
    { dust: 0.2, drift: 34, beacon: 0.85, hook: 0.55 },
  ];
  const phase = phases[(frameIndex - 1) % phases.length]!;
  const dustAlpha = phase.dust;
  const dx = phase.drift;
  const dust = [
    rect(369 + dx, 603, 20, 10, "#f1d193", dustAlpha * 0.72),
    rect(392 + dx, 594, 28, 12, "#d39a55", dustAlpha * 0.66),
    rect(414 + dx, 610, 18, 12, "#f6d99b", dustAlpha * 0.54),
    rect(382 + dx, 626, 34, 10, "#9f6b32", dustAlpha * 0.34),
    rect(436 + dx, 587, 12, 8, "#f1d193", dustAlpha * 0.42),
    rect(350 + dx, 620, 14, 8, "#d39a55", dustAlpha * 0.3),
  ];
  const settle = dustAlpha > 0.5
    ? [
        rect(390 + dx, 642, 32, 8, "#8b5d2b", dustAlpha * 0.35),
        rect(425 + dx, 637, 22, 7, "#7b5127", dustAlpha * 0.28),
      ]
    : [];

  const beacon = [
    rect(542, 384, 7, 7, "#ffef8a", phase.beacon),
    rect(539, 387, 13, 3, "#ff9f1c", phase.beacon * 0.72),
    rect(544, 382, 3, 13, "#ff9f1c", phase.beacon * 0.68),
  ];

  const hookGlint = [
    rect(514, 241, 8, 5, "#ffe07a", phase.hook),
    rect(518, 247, 4, 9, "#ffbf2f", phase.hook * 0.75),
  ];

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" shape-rendering="crispEdges">
  <g>${dust.join("")}${settle.join("")}</g>
  <g>${beacon.join("")}</g>
  <g>${hookGlint.join("")}</g>
</svg>
`.trim();
}

async function generateLockedBaseFrame(
  animationName: string,
  totalFrames: number,
  frameIndex: number,
  frame: Frame,
  sourceBuffer: Buffer,
  outDir: string,
): Promise<{ id: string; path: string; status: "wrote" | "failed"; reason?: string }> {
  const outPath = join(outDir, `${frame.id}.png`);
  const prompt = lockedBasePrompt(animationName, totalFrames, frameIndex, frame);

  console.log(`[${animationName}/${frame.id}] rendering locked-base frame…`);
  try {
    await sharp(sourceBuffer)
      .composite([{ input: Buffer.from(constructionOverlaySvg(frameIndex)), left: 0, top: 0 }])
      .png()
      .toFile(outPath);
    await writeFile(outPath.replace(/\.png$/, ".prompt.txt"), prompt + "\n");
    console.log(`[${animationName}/${frame.id}] → ${outPath}`);
    return { id: frame.id, path: outPath, status: "wrote" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[${animationName}/${frame.id}] FAILED: ${msg}`);
    return { id: frame.id, path: outPath, status: "failed", reason: msg };
  }
}

async function generateFrame(
  openai: OpenAI,
  animationName: string,
  totalFrames: number,
  frameIndex: number,
  frame: Frame,
  sourceBuffer: Buffer,
  outDir: string,
): Promise<{ id: string; path: string; status: "wrote" | "failed"; reason?: string }> {
  const outPath = join(outDir, `${frame.id}.png`);
  const prompt = [
    framePreamble(frameIndex, totalFrames, animationName),
    frame.body,
    FRAME_OUTPUT_RULES,
  ].join("\n\n");

  console.log(`[${animationName}/${frame.id}] generating…`);
  try {
    const refFile = await OpenAI.toFile(sourceBuffer, "ref.png", { type: "image/png" });
    const res = await openai.images.edit({
      model: MODEL,
      image: refFile,
      prompt,
      size: SIZE,
      quality: QUALITY,
      n: 1,
    } as Parameters<typeof openai.images.edit>[0]);

    const b64 = res.data?.[0]?.b64_json;
    if (!b64) {
      return { id: frame.id, path: outPath, status: "failed", reason: "no b64 in response" };
    }
    await writeFile(outPath, Buffer.from(b64, "base64"));
    await writeFile(
      outPath.replace(/\.png$/, ".prompt.txt"),
      prompt + "\n",
    );
    console.log(`[${animationName}/${frame.id}] → ${outPath}`);
    return { id: frame.id, path: outPath, status: "wrote" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[${animationName}/${frame.id}] FAILED: ${msg}`);
    return { id: frame.id, path: outPath, status: "failed", reason: msg };
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

// ---------- Sprite sheet composite -------------------------------------------

async function buildSpriteSheet(
  framePaths: string[],
  outPath: string,
): Promise<{ width: number; height: number; frameWidth: number; frameHeight: number }> {
  if (framePaths.length === 0) throw new Error("no frames to composite");
  const meta = await sharp(framePaths[0]!).metadata();
  const frameW = meta.width!;
  const frameH = meta.height!;
  const sheetW = frameW * framePaths.length;

  const composite = await Promise.all(
    framePaths.map(async (p, i) => ({
      input: await sharp(p).toBuffer(),
      left: i * frameW,
      top: 0,
    })),
  );

  await sharp({
    create: {
      width: sheetW,
      height: frameH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composite)
    .png()
    .toFile(outPath);

  return { width: sheetW, height: frameH, frameWidth: frameW, frameHeight: frameH };
}

// ---------- Main -------------------------------------------------------------

async function processOne(openai: OpenAI | null, anim: Animation, force: boolean) {
  const outDir = join(ANIMATIONS_DIR, anim.name);
  const sheetPath = join(outDir, "sheet.png");
  if (!force && (await fileExists(sheetPath))) {
    console.log(`[${anim.name}] skip (sheet exists — pass --force to re-roll)`);
    return;
  }

  const sourcePath = join(BUILDINGS_DIR, anim.sourceFile);
  if (!(await fileExists(sourcePath))) {
    console.error(`[${anim.name}] source not found: ${sourcePath}`);
    return;
  }
  await mkdir(outDir, { recursive: true });
  const sourceBuffer = await readFile(sourcePath);

  console.log(
    `[${anim.name}] generating ${anim.frames.length} frames in ${anim.mode} mode`,
  );

  const tasks = anim.frames.map((f, i) => ({ frame: f, index: i + 1 }));
  const results =
    anim.mode === "locked-base"
      ? await runBatch(
          tasks,
          (t) =>
            generateLockedBaseFrame(
              anim.name,
              anim.frames.length,
              t.index,
              t.frame,
              sourceBuffer,
              outDir,
            ),
          CONCURRENCY,
        )
      : await runBatch(
          tasks,
          (t) => {
            if (!openai) {
              throw new Error("OPENAI_API_KEY required for ai-edit animations");
            }
            return generateFrame(
              openai,
              anim.name,
              anim.frames.length,
              t.index,
              t.frame,
              sourceBuffer,
              outDir,
            );
          },
          CONCURRENCY,
        );

  const wrote = results.filter((r) => r.status === "wrote");
  const failed = results.filter((r) => r.status === "failed");
  if (failed.length > 0) {
    console.error(`[${anim.name}] FAILED frames:`);
    for (const f of failed) console.error(`  - ${f.id}: ${f.reason ?? "?"}`);
    return;
  }
  console.log(`[${anim.name}] all ${wrote.length} frames generated. composing sheet…`);

  const framePaths = wrote
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((r) => r.path);
  const sheetMeta = await buildSpriteSheet(framePaths, sheetPath);

  const meta = {
    name: anim.name,
    source: anim.sourceFile,
    frameCount: anim.frames.length,
    frameWidth: sheetMeta.frameWidth,
    frameHeight: sheetMeta.frameHeight,
    sheetWidth: sheetMeta.width,
    sheetHeight: sheetMeta.height,
    suggestedFps: anim.fps,
    loop: true,
    mode: anim.mode,
    stableBase: anim.mode === "locked-base",
    createdAt: new Date().toISOString(),
  };
  await writeFile(join(outDir, "meta.json"), JSON.stringify(meta, null, 2) + "\n");
  console.log(`[${anim.name}] sheet → ${sheetPath} (${sheetMeta.width}×${sheetMeta.height})`);
  console.log(`[${anim.name}] meta  → ${join(outDir, "meta.json")}`);
}

async function main() {
  const { force, only } = parseArgs(process.argv);
  const candidates = ANIMATIONS.filter((a) => (only ? only.has(a.name) : true));
  if (candidates.length === 0) {
    console.log("no animations match.");
    return;
  }

  const needsOpenAI = candidates.some((a) => a.mode === "ai-edit");
  if (needsOpenAI && !process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY not set. Copy .env.example to .env and fill it in.");
    process.exit(1);
  }
  const openai = needsOpenAI ? new OpenAI() : null;

  for (const anim of candidates) {
    await processOne(openai, anim, force);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
