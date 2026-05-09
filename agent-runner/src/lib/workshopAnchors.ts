export type GridPos = { x: number; y: number };

// Hardcoded 10 workshop anchors laid out as a 5×2 grid on the 48×32 map. Each
// anchor is the center of a 3×3 construction-site footprint; the agent stands
// one tile south. Spacing keeps footprints non-overlapping and well clear of
// the marina-water border. The `map` arg is kept for API parity but unused —
// edit this list directly to relocate or add sites. Must stay in sync with
// client/src/lib/workshopAnchors.ts.
const ANCHORS: GridPos[] = [
  { x: 3, y: 17 },
  { x: 32, y: 15 },
  { x: 26, y: 18 },
  { x: 29, y: 9 },
  { x: 12, y: 4 },
  { x: 30, y: 26 },
  { x: 18, y: 28 },
  { x: 25, y: 3 },
  { x: 41, y: 12 },
  { x: 21, y: 18 },
];

export function workshopAnchors(_map: { width: number; height: number }): GridPos[] {
  return ANCHORS;
}

export function nearestAnchor(pos: GridPos, anchors: GridPos[]): GridPos {
  let best = anchors[0]!;
  let bestD = Infinity;
  for (const a of anchors) {
    const d = Math.abs(pos.x - a.x) + Math.abs(pos.y - a.y);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

export function stepToward(from: GridPos, to: GridPos): GridPos {
  if (from.x < to.x) return { x: from.x + 1, y: from.y };
  if (from.x > to.x) return { x: from.x - 1, y: from.y };
  if (from.y < to.y) return { x: from.x, y: from.y + 1 };
  if (from.y > to.y) return { x: from.x, y: from.y - 1 };
  return { ...from };
}
