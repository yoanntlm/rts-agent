// One-shot asset generator — H6 stub.
//
// Generates tiles, character sprites, and items via gpt-image-2 and writes them
// into client/public/assets/generated/. Re-run anytime to refresh the theme.
//
// Run with: pnpm assets:gen

import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import OpenAI from "openai";

const OUT_DIR = join(process.cwd(), "..", "client", "public", "assets", "generated");

const TARGETS = [
  { name: "tile-grass", prompt: "top-down 64x64 pixel-art grass tile, seamless, JRPG style" },
  { name: "tile-stone", prompt: "top-down 64x64 pixel-art stone tile, seamless, JRPG style" },
  { name: "tile-workshop", prompt: "top-down 64x64 pixel-art wooden workshop floor tile" },
  { name: "char-frontend", prompt: "top-down RTS character sprite, frontend developer with scroll, teal tunic, 64x64" },
  { name: "char-backend", prompt: "top-down RTS character sprite, backend engineer with hammer, yellow tunic, 64x64" },
  { name: "char-tester", prompt: "top-down RTS character sprite, tester with magnifying glass, red tunic, 64x64" },
  { name: "char-refactorer", prompt: "top-down RTS character sprite, refactorer with broom, purple tunic, 64x64" },
  { name: "char-devops", prompt: "top-down RTS character sprite, devops engineer with wrench, green tunic, 64x64" },
];

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY not set. Copy .env.example to .env and fill it in.");
    process.exit(1);
  }
  await mkdir(OUT_DIR, { recursive: true });
  const openai = new OpenAI();

  for (const target of TARGETS) {
    console.log(`generating ${target.name}…`);
    // NOTE: model name and response shape will need to match the actual gpt-image-2 API.
    // This stub assumes a base64 PNG response.
    const res = await openai.images.generate({
      model: "gpt-image-2",
      prompt: target.prompt,
      size: "1024x1024",
    } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b64 = (res.data?.[0] as any)?.b64_json;
    if (!b64) {
      console.warn(`  no image returned for ${target.name}`);
      continue;
    }
    const out = join(OUT_DIR, `${target.name}.png`);
    await writeFile(out, Buffer.from(b64, "base64"));
    console.log(`  → ${out}`);
  }
  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
