export type AvatarPromptInput = {
  id?: string;
  title: string;
  color: string;
  shortBio?: string;
  skillLabel?: string;
  promptFocus?: string;
};

export const AVATAR_IMAGE_MODEL = "gpt-image-2";
export const AVATAR_IMAGE_SIZE = "1024x1024";
export const AVATAR_IMAGE_QUALITY = "high";

export const AVATAR_STYLE_PREAMBLE = `
COZY PIXEL-ART CHARACTER SPRITE — STARDEW VALLEY STYLE NPC.

Style technique: Stardew Valley pixel-art NPC sprite — hand-painted feel,
gentle dithering, visible pixel grain but not chunky, soft outlines on
the body silhouette, no harsh black strokes.

Subject: an in-game NPC standing on its legs, FULL-BODY visible from
HEAD TO TOE. Modern tropical Singapore civic worker, NOT medieval, NOT
fantasy, NOT samurai/anime, NOT pirate. Same world as our park grass,
hawker tile, HDB void-deck pavers — bright equatorial midday light.

Perspective: top-down 3/4 OBLIQUE view (the classic Stardew Valley NPC
angle). Camera looks down and slightly forward at the character — face,
torso, and legs are ALL VISIBLE. NOT a strict top-down view of just the
head. NOT a fully side-on profile.

Composition: ONE character, centered horizontally, facing the viewer
(facing forward / "south"). Character occupies the central column of
the frame, head near the top, feet near the bottom. The character
fills roughly 80–90% of the frame height — fitting comfortably within
a 1×1 tile cell when placed in the game world. Slightly chibi-ish
proportions (head is roughly 1/4 of the total body height) but
readable as an adult professional, not a child.

Output rules:
- Background must be a SOLID FLAT PURE WHITE (#ffffff) filling the
  entire frame around the character — no gradient, no texture, no
  scenery, no environmental hints. The character is a sticker on a
  blank white card. We post-process / chroma-key this background out
  later when we need to drop the character onto game tiles.
- No drop shadow on the ground, no platform, no podium under the feet.
- No frame, no border, no signature, no grid, no name tag, no speech
  bubble.
- Single character only — no companions, no pet.
- Two arms and two legs visible, both feet on the ground.

Palette mood: warm tropical Singapore midday — saturated but not
neon. Skin tones are natural East/Southeast-Asian-Singapore-typical
(any of the spectrum). Match the SAME pixel-grain saturation as our
existing tile set.

EXPLICITLY AVOID: medieval armor, fantasy robes, knight, wizard,
samurai, pirate, ninja, anime giant eyes, photorealistic styling,
generic stock illustration, side-profile, strict top-down (no
"head-only seen from above"), gradient or scenery or photo
backgrounds (must be FLAT WHITE), decorative borders, ground shadows,
props larger than the character.
`.trim();

const ROLE_VISUALS: Record<string, string> = {
  frontend: `
This NPC is the FRONTEND SPECIALIST — a Singapore digital-product
designer / web engineer. Wears a soft TROPICAL TEAL POLO SHIRT
(primary color #4ECDC4), light cream chino shorts, simple canvas
sneakers. Holds a small TABLET / SKETCHPAD in one hand. Round
glasses optional. Friendly, approachable expression — the kind of
person you'd see in a Tiong Bahru co-working café.
`.trim(),

  backend: `
This NPC is the BACKEND SPECIALIST — a Singapore systems engineer
who builds APIs and data models. Wears a SUNNY GOLD POLO SHIRT
(primary color #FFD166) with a small TOOL BELT around the waist,
dark cargo trousers, sturdy work boots. Holds a SMALL TOOLBOX or
compact hammer in one hand. Practical, ready-to-build energy.
`.trim(),

  tester: `
This NPC is the TESTER — a Singapore QA engineer in detective mode.
Wears a CRIMSON PINK BUTTON-UP SHIRT (primary color #EF476F) under a
dark utility vest, navy slacks, leather shoes. Holds a SMALL
MAGNIFYING GLASS in one hand and a slim CLIPBOARD in the other.
Focused, slightly skeptical expression — bug-hunter energy.
`.trim(),

  refactorer: `
This NPC is the REFACTORER — a Singapore code-cleanup specialist who
tidies messy implementations. Wears a SOFT LAVENDER POLO SHIRT
(primary color #A78BFA) under a clean white APRON, dark trousers,
soft-soled shoes. Holds a SMALL BROOM in one hand and a tidy toolkit
pouch in the other. Marie-Kondo-the-codebase energy — calm,
methodical.
`.trim(),

  devops: `
This NPC is the DEVOPS SPECIALIST — a Singapore infrastructure
technician. Wears a MINT-GREEN MUNICIPAL COVERALL / boiler suit
(primary color #06D6A0) with a TOOL BELT, sturdy boots, a small
dark cap or hard-hat. Holds a LARGE WRENCH in one hand. The kind
of technician you'd see fixing a server-room AC unit on a hot
afternoon.
`.trim(),
};

export function buildAvatarPrompt(input: AvatarPromptInput): string {
  const title = input.title.trim();
  const presetVisual = input.id ? ROLE_VISUALS[input.id] : undefined;
  const visual =
    presetVisual ??
    `
This NPC is "${title}" — interpret that title as a specific professional
teammate role in a software-building crew. The visual identity should make the
title instantly legible without using any text in the image.

Role focus: ${input.promptFocus || input.shortBio || input.skillLabel || "software teamwork"}.
Primary clothing accent color: ${input.color}. Use this color on a shirt,
jacket, apron, coverall, accessory, or tool detail, while keeping the whole
character grounded in modern tropical Singapore.

Give the character one small role-appropriate handheld prop if it helps explain
the title. The prop must be smaller than the torso and must not obscure the
full-body silhouette.
`.trim();

  const identity = input.id ? `${title} (${input.id})` : title;
  return `${AVATAR_STYLE_PREAMBLE}\n\nCharacter: ${identity}. ${visual}`;
}
