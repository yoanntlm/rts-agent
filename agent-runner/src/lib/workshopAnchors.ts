export type GridPos = { x: number; y: number };

/** Four quadrant workshop anchors (integer tile coords), inset from edges. */
export function workshopAnchors(map: { width: number; height: number }): GridPos[] {
  const { width: w, height: h } = map;
  const inset = 2;
  const qx = [Math.floor(w * 0.25), Math.floor(w * 0.75)];
  const qy = [Math.floor(h * 0.25), Math.floor(h * 0.75)];
  const clamp = (x: number, max: number) => Math.max(inset, Math.min(max - inset - 1, x));
  return [
    { x: clamp(qx[0]!, w), y: clamp(qy[0]!, h) },
    { x: clamp(qx[1]!, w), y: clamp(qy[0]!, h) },
    { x: clamp(qx[0]!, w), y: clamp(qy[1]!, h) },
    { x: clamp(qx[1]!, w), y: clamp(qy[1]!, h) },
  ];
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
