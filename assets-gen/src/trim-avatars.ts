// Background-trim for character avatars.
//
// gpt-image-2 produces opaque PNGs (this project doesn't have access to
// `background: transparent`). The avatar prompts ask for a flat white
// background — this script chroma-keys that white away so the avatars can
// drop onto any tile in the world.
//
// Algorithm: edge-seeded flood-fill, with a distance-to-white score driving
// per-pixel alpha. Pixels close to pure white get alpha 0; pixels at the
// soft anti-aliased edge get partial alpha for a smooth fade. White pixels
// INSIDE the character (e.g. the refactorer's apron) are NOT eaten because
// they're not connected to the edge background.
//
// Layout:
//   client/public/assets/chars/<id>.png       ← live (overwritten)
//   client/public/assets/chars/raw/<id>.png   ← preserved original (gitignored)
//
// Re-runs always trim from raw/ → chars/, so re-tuning thresholds is
// non-destructive.
//
// Run with:
//   pnpm assets:trim-avatars                       # all preset avatars
//   pnpm assets:trim-avatars -- --only=frontend    # subset
//   pnpm assets:trim-avatars -- --inner=15 --outer=45   # tune softness

import sharp from "sharp";
import { readdir, mkdir, copyFile, access } from "node:fs/promises";
import { constants as FS } from "node:fs";
import { join, resolve } from "node:path";

const CHARS_DIR = resolve(
  process.cwd(),
  "..",
  "client",
  "public",
  "assets",
  "chars",
);
const RAW_DIR = join(CHARS_DIR, "raw");

// Distance from pure white (RGB 255,255,255). Higher = farther from white.
//
//   distSq <= INNER²       → fully transparent (alpha 0)
//   INNER² < distSq < OUTER² → linear partial alpha (soft edge)
//   distSq >= OUTER²       → not white enough; flood-fill stops (alpha unchanged)
//
// Defaults are tuned for gpt-image-2 output — strict enough to preserve
// near-white areas inside the character (white aprons, white shoes) but
// generous enough to eat anti-alias halos around the silhouette.
const DEFAULT_INNER = 12;
const DEFAULT_OUTER = 36;
const CONCURRENCY = 4;

// ---------- CLI args ----------------------------------------------------------

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  const set = new Set(args);
  const onlyArg = args.find((a) => a.startsWith("--only="));
  const innerArg = args.find((a) => a.startsWith("--inner="));
  const outerArg = args.find((a) => a.startsWith("--outer="));
  return {
    only: onlyArg ? new Set(onlyArg.slice("--only=".length).split(",")) : null,
    inner: innerArg ? Number.parseFloat(innerArg.slice("--inner=".length)) : DEFAULT_INNER,
    outer: outerArg ? Number.parseFloat(outerArg.slice("--outer=".length)) : DEFAULT_OUTER,
    quiet: set.has("--quiet"),
  };
}

// ---------- File helpers ------------------------------------------------------

async function fileExists(path: string) {
  try {
    await access(path, FS.F_OK);
    return true;
  } catch {
    return false;
  }
}

// ---------- Trim core ---------------------------------------------------------

/**
 * Edge-seeded flood-fill that turns near-white background pixels transparent.
 * White pixels inside the character (not connected to the edge) are preserved.
 */
async function trimOne(
  srcPath: string,
  dstPath: string,
  inner: number,
  outer: number,
): Promise<{ width: number; height: number; trimmed: number; total: number }> {
  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const channels = info.channels;
  const total = width * height;

  const innerSq = inner * inner;
  const outerSq = outer * outer;
  const range = outer - inner;

  // visited prevents repeat work — marked at push time, so each pixel
  // is enqueued at most once. Stack size bound: total pixels.
  const visited = new Uint8Array(total);
  const stack = new Int32Array(total);
  let sp = 0;

  // Seed every edge pixel.
  for (let x = 0; x < width; x++) {
    if (!visited[x]) {
      visited[x] = 1;
      stack[sp++] = x;
    }
    const bottom = (height - 1) * width + x;
    if (!visited[bottom]) {
      visited[bottom] = 1;
      stack[sp++] = bottom;
    }
  }
  for (let y = 1; y < height - 1; y++) {
    const left = y * width;
    const right = left + width - 1;
    if (!visited[left]) {
      visited[left] = 1;
      stack[sp++] = left;
    }
    if (!visited[right]) {
      visited[right] = 1;
      stack[sp++] = right;
    }
  }

  let trimmed = 0;

  while (sp > 0) {
    const idx = stack[--sp]!;
    const off = idx * channels;
    const dr = 255 - data[off]!;
    const dg = 255 - data[off + 1]!;
    const db = 255 - data[off + 2]!;
    const distSq = dr * dr + dg * dg + db * db;

    // Pixel is "not white enough" — it's on the character. Stop the wave here.
    if (distSq > outerSq) continue;

    if (distSq <= innerSq) {
      data[off + 3] = 0;
    } else {
      const dist = Math.sqrt(distSq);
      const alpha = Math.round(((dist - inner) / range) * 255);
      // min with existing alpha so pre-existing transparency isn't increased
      const cur = data[off + 3]!;
      data[off + 3] = cur < alpha ? cur : alpha;
    }
    trimmed++;

    // Propagate to 4-connected neighbors.
    const x = idx % width;
    const y = (idx - x) / width;
    if (x > 0) {
      const n = idx - 1;
      if (!visited[n]) {
        visited[n] = 1;
        stack[sp++] = n;
      }
    }
    if (x < width - 1) {
      const n = idx + 1;
      if (!visited[n]) {
        visited[n] = 1;
        stack[sp++] = n;
      }
    }
    if (y > 0) {
      const n = idx - width;
      if (!visited[n]) {
        visited[n] = 1;
        stack[sp++] = n;
      }
    }
    if (y < height - 1) {
      const n = idx + width;
      if (!visited[n]) {
        visited[n] = 1;
        stack[sp++] = n;
      }
    }
  }

  await sharp(data, {
    raw: { width, height, channels },
  })
    .png()
    .toFile(dstPath);

  return { width, height, trimmed, total };
}

// ---------- Batch runner ------------------------------------------------------

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

// ---------- Main --------------------------------------------------------------

async function main() {
  const { only, inner, outer, quiet } = parseArgs(process.argv);
  await mkdir(RAW_DIR, { recursive: true });

  const entries = (await readdir(CHARS_DIR, { withFileTypes: true }))
    .filter((e) => e.isFile() && e.name.endsWith(".png"))
    .map((e) => e.name)
    .sort();

  const targets = entries
    .map((file) => ({ id: file.replace(/\.png$/, ""), file }))
    .filter((t) => (only ? only.has(t.id) : true));

  if (targets.length === 0) {
    console.log("nothing to trim.");
    return;
  }

  console.log(
    `trimming ${targets.length} avatar(s) — inner=${inner} outer=${outer} concurrency=${CONCURRENCY}\n`,
  );

  const results = await runBatch(
    targets,
    async (t) => {
      const live = join(CHARS_DIR, t.file);
      const raw = join(RAW_DIR, t.file);
      // Back up original on first run; subsequent runs always trim from raw.
      if (!(await fileExists(raw))) {
        await copyFile(live, raw);
      }
      const stats = await trimOne(raw, live, inner, outer);
      if (!quiet) {
        const pct = ((stats.trimmed / stats.total) * 100).toFixed(1);
        console.log(
          `[${t.id}] ${stats.width}×${stats.height} — ${stats.trimmed}/${stats.total} px touched (${pct}%)`,
        );
      }
      return { id: t.id, ok: true };
    },
    CONCURRENCY,
  );

  const ok = results.filter((r) => r.ok).length;
  console.log(`\ndone. trimmed=${ok}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
