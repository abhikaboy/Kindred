export type DropRect = { key: string; left: number; top: number; right: number; bottom: number };

// Last match wins so a later-registered (visually topmost) target takes priority.
export function hitTest(point: { x: number; y: number }, rects: DropRect[]): string | null {
  let hit: string | null = null;
  for (const r of rects) {
    if (point.x >= r.left && point.x <= r.right && point.y >= r.top && point.y <= r.bottom) {
      hit = r.key;
    }
  }
  return hit;
}
