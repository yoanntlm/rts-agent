// Singapore landmarks rendered as the "finished building" once an agent
// completes its task. Files live under client/public/assets/tiles/ — the URL
// path is what gets persisted on the agent doc.

const TILES_DIR = "/assets/tiles";

const u = (filename: string) => `${TILES_DIR}/${encodeURI(filename)}`;

// First N monuments are picked in order so the early reveals look hand-curated
// — recognizable Singapore icons. After this list runs out, picks are random
// from RANDOM_POOL.
export const HARDCODED_SEQUENCE = [
  u("MBS1.jpg"),
  u("merlion.jpg"),
  u("Gardens by the bay1.jpg"),
  u("Peranakan.jpg"),
  u("Chinatown2.jpg"),
];

// Random pool for any monument past the hardcoded sequence. Curated to skip
// the photos that read poorly when projected onto a 3×3 ground plane.
const RANDOM_POOL = [
  u("MBS2.jpg"),
  u("Gardens by the bay2.jpg"),
  u("Gardens by the bay3.jpg"),
  u("Jewel1.jpg"),
  u("Chinatown1.jpg"),
  u("peranakan2.jpg"),
  u("peranakan3.jpg"),
  u("peranakan4.jpg"),
  u("peranakan5.jpg"),
  u("peranakan6.jpg"),
  u("peranakan7.jpg"),
  u("dragonplayground.jpg"),
  u("SGriver.jpg"),
  u("purpletree.jpg"),
  u("Bright flowers.jpg"),
  u("flowers1.jpg"),
  u("merliontop.jpg"),
];

/**
 * Returns the n-th monument by completion order.
 * - completedCount=0..HARDCODED_SEQUENCE.length-1 → curated landmark
 * - completedCount >= HARDCODED_SEQUENCE.length → random pick from the pool
 */
export function pickMonument(completedCount: number): string {
  if (completedCount < HARDCODED_SEQUENCE.length) {
    return HARDCODED_SEQUENCE[completedCount]!;
  }
  const i = Math.floor(Math.random() * RANDOM_POOL.length);
  return RANDOM_POOL[i]!;
}
