// Vite dev-server plugin exposing a tiny image-gen API for the /playground page.
// Dev-only — never registered in production builds. Reads OPENAI_API_KEY from
// either client/.env.local (Vite default) or assets-gen/.env (so we don't
// duplicate the key across packages).
//
// Endpoints:
//   POST /api/img/generate  → call OpenAI images.generate or .edit (when refs)
//   POST /api/img/save      → write a PNG + sidecars to public/assets/playground/
//   GET  /api/img/library   → list saved entries with their metadata
//   POST /api/img/promote   → copy a library PNG into public/assets/generated/<key>.png
//   GET  /api/img/tile-keys → list of valid TileKind names
//   POST /api/img/avatar    → generate and save a custom character portrait

import type { Plugin, ViteDevServer } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import OpenAI from "openai";
import { config as loadDotenv } from "dotenv";
import { readdir, readFile, writeFile, mkdir, copyFile, stat } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { existsSync } from "node:fs";
import {
  AVATAR_IMAGE_MODEL,
  AVATAR_IMAGE_QUALITY,
  AVATAR_IMAGE_SIZE,
  buildAvatarPrompt,
} from "../src/lib/avatarPrompt";

const PUBLIC_DIR = resolve(__dirname, "..", "public");
const PLAYGROUND_DIR = join(PUBLIC_DIR, "assets", "playground");
const GENERATED_DIR = join(PUBLIC_DIR, "assets", "generated");
const GENERATED_AVATAR_DIR = join(PUBLIC_DIR, "assets", "chars", "generated");

// Try the local .env first, then fall back to assets-gen/.env so the
// existing key isn't duplicated across packages.
function ensureOpenAIKey() {
  if (process.env.OPENAI_API_KEY) return;
  const candidates = [
    resolve(__dirname, "..", ".env.local"),
    resolve(__dirname, "..", ".env"),
    resolve(__dirname, "..", "..", "assets-gen", ".env"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) loadDotenv({ path: p });
    if (process.env.OPENAI_API_KEY) return;
  }
}

// ---------- Tiny request helpers ---------------------------------------------

async function readJsonBody<T = unknown>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? (JSON.parse(raw) as T) : ({} as T);
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

function fail(res: ServerResponse, status: number, message: string) {
  send(res, status, { error: message });
}

// ---------- Endpoint: generate -----------------------------------------------

type GenerateBody = {
  prompt: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
  quality?: "low" | "medium" | "high" | "auto";
  n?: number;
  background?: "opaque" | "transparent" | "auto";
  model?: string;
  /** base64-encoded PNGs to use as visual references (triggers images.edit). */
  refImages?: string[];
};

async function handleGenerate(
  req: IncomingMessage,
  res: ServerResponse,
  openai: OpenAI,
) {
  let body: GenerateBody;
  try {
    body = await readJsonBody<GenerateBody>(req);
  } catch {
    return fail(res, 400, "Invalid JSON body");
  }
  if (!body.prompt || typeof body.prompt !== "string") {
    return fail(res, 400, "Missing 'prompt'");
  }

  const model = body.model ?? "gpt-image-2";
  const size = body.size ?? "1024x1024";
  const quality = body.quality ?? "high";
  const n = Math.max(1, Math.min(4, body.n ?? 1));
  const background = body.background ?? "opaque";
  const refs = (body.refImages ?? []).filter(
    (r) => typeof r === "string" && r.length > 0,
  );

  try {
    let images: string[] = [];
    if (refs.length > 0) {
      // images.edit accepts an Uploadable or array of Uploadables for `image`.
      const files = await Promise.all(
        refs.map(async (b64, i) =>
          OpenAI.toFile(Buffer.from(b64, "base64"), `ref-${i}.png`, {
            type: "image/png",
          }),
        ),
      );
      const res2 = await openai.images.edit({
        model,
        image: files,
        prompt: body.prompt,
        size,
        quality,
        n,
        background,
      } as Parameters<typeof openai.images.edit>[0]);
      images = (res2.data ?? [])
        .map((d) => d.b64_json ?? "")
        .filter((s) => s.length > 0);
    } else {
      const res2 = await openai.images.generate({
        model,
        prompt: body.prompt,
        size,
        quality,
        n,
        background,
      } as Parameters<typeof openai.images.generate>[0]);
      images = (res2.data ?? [])
        .map((d) => d.b64_json ?? "")
        .filter((s) => s.length > 0);
    }

    if (images.length === 0) {
      return fail(res, 502, "OpenAI returned no images");
    }
    return send(res, 200, { images });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[img/generate] failed:", msg);
    return fail(res, 502, msg);
  }
}

// ---------- Endpoint: save ---------------------------------------------------

type SaveBody = {
  /** filename slug — we'll prefix with timestamp + sanitize. */
  name: string;
  /** base64 PNG */
  b64: string;
  /** original prompt for the sidecar */
  prompt: string;
  /** generation params for the sidecar */
  params?: Record<string, unknown>;
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "untitled";
}

async function handleSave(req: IncomingMessage, res: ServerResponse) {
  let body: SaveBody;
  try {
    body = await readJsonBody<SaveBody>(req);
  } catch {
    return fail(res, 400, "Invalid JSON body");
  }
  if (!body.b64 || !body.prompt) return fail(res, 400, "Missing b64 or prompt");

  await mkdir(PLAYGROUND_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:]/g, "-").replace(/\..+$/, "");
  const slug = slugify(body.name || body.prompt);
  const base = `${ts}_${slug}`;
  const pngPath = join(PLAYGROUND_DIR, `${base}.png`);
  const promptPath = join(PLAYGROUND_DIR, `${base}.prompt.txt`);
  const paramsPath = join(PLAYGROUND_DIR, `${base}.params.json`);

  await writeFile(pngPath, Buffer.from(body.b64, "base64"));
  await writeFile(promptPath, body.prompt);
  await writeFile(paramsPath, JSON.stringify(body.params ?? {}, null, 2));

  return send(res, 200, { filename: `${base}.png` });
}

// ---------- Endpoint: library ------------------------------------------------

type LibraryEntry = {
  filename: string;
  url: string;
  prompt: string;
  params: Record<string, unknown>;
  savedAt: string;
};

async function handleLibrary(_req: IncomingMessage, res: ServerResponse) {
  await mkdir(PLAYGROUND_DIR, { recursive: true });
  const files = await readdir(PLAYGROUND_DIR);
  const pngs = files.filter((f) => f.endsWith(".png")).sort().reverse(); // newest first
  const entries: LibraryEntry[] = [];
  for (const png of pngs) {
    const base = png.replace(/\.png$/, "");
    const promptPath = join(PLAYGROUND_DIR, `${base}.prompt.txt`);
    const paramsPath = join(PLAYGROUND_DIR, `${base}.params.json`);
    let prompt = "";
    let params: Record<string, unknown> = {};
    try {
      prompt = await readFile(promptPath, "utf8");
    } catch {
      // sidecar missing — leave empty
    }
    try {
      const raw = await readFile(paramsPath, "utf8");
      params = JSON.parse(raw);
    } catch {
      // sidecar missing or invalid — leave empty
    }
    let savedAt = "";
    try {
      const s = await stat(join(PLAYGROUND_DIR, png));
      savedAt = s.mtime.toISOString();
    } catch {
      // ignore
    }
    entries.push({
      filename: png,
      url: `/assets/playground/${png}`,
      prompt,
      params,
      savedAt,
    });
  }
  return send(res, 200, { entries });
}

// ---------- Endpoint: promote ------------------------------------------------

// Mirrors TILE_PATHS keys in client/src/lib/tiles.ts. Updated alongside.
const VALID_TILE_KEYS = new Set([
  "parkGrass",
  "parkGrassOrchid",
  "parkGrassHibiscus",
  "parkGrassRooster",
  "parkGrassMynah",
  "parkGrassMango",
  "tropicalFoliage",
  "lalangGrass",
  "paverBeige",
  "paverRedBrick",
  "voidDeckTile",
  "roadAsphalt",
  "roadCenterLine",
  "roadZebra",
  "roadBusLane",
  "hawkerTile",
  "kopitiamTile",
  "marinaWater",
  "monsoonDrain",
]);

const TILE_KEY_TO_FILE: Record<string, string> = {
  parkGrass: "park-grass.png",
  parkGrassOrchid: "park-grass-orchid.png",
  parkGrassHibiscus: "park-grass-hibiscus.png",
  parkGrassRooster: "park-grass-rooster.png",
  parkGrassMynah: "park-grass-mynah.png",
  parkGrassMango: "park-grass-mango.png",
  tropicalFoliage: "tropical-foliage.png",
  lalangGrass: "lalang-grass.png",
  paverBeige: "paver-beige.png",
  paverRedBrick: "paver-red-brick.png",
  voidDeckTile: "void-deck-tile.png",
  roadAsphalt: "road-asphalt.png",
  roadCenterLine: "road-center-line.png",
  roadZebra: "road-zebra.png",
  roadBusLane: "road-bus-lane.png",
  hawkerTile: "hawker-tile.png",
  kopitiamTile: "kopitiam-tile.png",
  marinaWater: "marina-water.png",
  monsoonDrain: "monsoon-drain.png",
};

type PromoteBody = { libraryFilename: string; tileKey: string };

async function handlePromote(req: IncomingMessage, res: ServerResponse) {
  let body: PromoteBody;
  try {
    body = await readJsonBody<PromoteBody>(req);
  } catch {
    return fail(res, 400, "Invalid JSON body");
  }
  if (!body.libraryFilename || !body.tileKey) {
    return fail(res, 400, "Missing libraryFilename or tileKey");
  }
  if (!VALID_TILE_KEYS.has(body.tileKey)) {
    return fail(res, 400, `Unknown tileKey: ${body.tileKey}`);
  }
  // Disallow path-traversal in library filename.
  if (body.libraryFilename.includes("/") || body.libraryFilename.includes("..")) {
    return fail(res, 400, "Invalid library filename");
  }

  const src = join(PLAYGROUND_DIR, body.libraryFilename);
  const dst = join(GENERATED_DIR, TILE_KEY_TO_FILE[body.tileKey]!);
  await mkdir(dirname(dst), { recursive: true });
  await copyFile(src, dst);
  return send(res, 200, { ok: true, dst: `/assets/generated/${TILE_KEY_TO_FILE[body.tileKey]}` });
}

async function handleTileKeys(_req: IncomingMessage, res: ServerResponse) {
  return send(res, 200, { keys: [...VALID_TILE_KEYS] });
}

// ---------- Endpoint: avatar -------------------------------------------------

type AvatarBody = {
  title: string;
  color?: string;
  skillLabel?: string;
  shortBio?: string;
  promptFocus?: string;
};

async function handleAvatar(
  req: IncomingMessage,
  res: ServerResponse,
  openai: OpenAI,
) {
  let body: AvatarBody;
  try {
    body = await readJsonBody<AvatarBody>(req);
  } catch {
    return fail(res, 400, "Invalid JSON body");
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return fail(res, 400, "Missing 'title'");
  if (title.length > 80) return fail(res, 400, "Title must be 80 characters or less");

  const color =
    typeof body.color === "string" && /^#[0-9a-f]{6}$/i.test(body.color)
      ? body.color
      : "#4ECDC4";
  const prompt = buildAvatarPrompt({
    title,
    color,
    skillLabel: body.skillLabel,
    shortBio: body.shortBio,
    promptFocus: body.promptFocus,
  });

  try {
    const generated = await openai.images.generate({
      model: AVATAR_IMAGE_MODEL,
      prompt,
      size: AVATAR_IMAGE_SIZE,
      quality: AVATAR_IMAGE_QUALITY,
      n: 1,
    } as Parameters<typeof openai.images.generate>[0]);

    const b64 = generated.data?.[0]?.b64_json;
    if (!b64) return fail(res, 502, "OpenAI returned no image");

    await mkdir(GENERATED_AVATAR_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:]/g, "-").replace(/\..+$/, "");
    const base = `${ts}_${slugify(title)}`;
    const pngPath = join(GENERATED_AVATAR_DIR, `${base}.png`);
    const promptPath = join(GENERATED_AVATAR_DIR, `${base}.prompt.txt`);
    await writeFile(pngPath, Buffer.from(b64, "base64"));
    await writeFile(promptPath, prompt + "\n");

    return send(res, 200, {
      url: `/assets/chars/generated/${base}.png`,
      prompt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[img/avatar] failed:", msg);
    return fail(res, 502, msg);
  }
}

// ---------- Plugin -----------------------------------------------------------

export function imgApiPlugin(): Plugin {
  return {
    name: "rts-agent:img-api",
    apply: "serve", // dev only
    configureServer(server: ViteDevServer) {
      ensureOpenAIKey();
      if (!process.env.OPENAI_API_KEY) {
        server.config.logger.warn(
          "[img-api] OPENAI_API_KEY not set — /api/img/* endpoints will return 500.",
        );
      }
      const openai = new OpenAI();

      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "";
        const method = (req.method ?? "GET").toUpperCase();
        try {
          if (url === "/api/img/generate" && method === "POST") {
            return await handleGenerate(req, res, openai);
          }
          if (url === "/api/img/save" && method === "POST") {
            return await handleSave(req, res);
          }
          if (url === "/api/img/library" && method === "GET") {
            return await handleLibrary(req, res);
          }
          if (url === "/api/img/promote" && method === "POST") {
            return await handlePromote(req, res);
          }
          if (url === "/api/img/tile-keys" && method === "GET") {
            return await handleTileKeys(req, res);
          }
          if (url === "/api/img/avatar" && method === "POST") {
            return await handleAvatar(req, res, openai);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[img-api] handler error:", msg);
          if (!res.headersSent) return fail(res, 500, msg);
        }
        next();
      });
    },
  };
}
