// Singapore landmarks rendered as the "finished building" once an agent
// completes its task. Files live under client/public/assets/tiles/ — the URL
// path is what gets persisted on the agent doc.

const TILES_DIR = "/assets/tiles";

const MONUMENT_FILES = [
  "MBS1.jpg",
  "MBS2.jpg",
  "Gardens by the bay1.jpg",
  "Gardens by the bay2.jpg",
  "Gardens by the bay3.jpg",
  "Jewel1.jpg",
  "Chinatown1.jpg",
  "Chinatown2.jpg",
  "Peranakan.jpg",
  "peranakan2.jpg",
  "peranakan3.jpg",
  "peranakan4.jpg",
  "peranakan5.jpg",
  "peranakan6.jpg",
  "peranakan7.jpg",
  "dragonplayground.jpg",
  "SGriver.jpg",
  "purpletree.jpg",
  "Bright flowers.jpg",
  "flowers1.jpg",
];

export const MONUMENT_URLS = MONUMENT_FILES.map((f) => `${TILES_DIR}/${encodeURI(f)}`);

export function pickRandomMonument(): string {
  const i = Math.floor(Math.random() * MONUMENT_URLS.length);
  return MONUMENT_URLS[i]!;
}
