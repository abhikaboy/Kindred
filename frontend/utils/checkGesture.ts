// Pure, so tests can load it without native modules.

export type Point = { x: number; y: number };

/**
 * A check: goes down to a low point, then rises further than it fell, moving
 * right overall. Screen coordinates, so a larger y is lower on the screen.
 * Same heuristic as the approved prototype.
 */
export function isCheck(pts: Point[]): boolean {
    if (pts.length < 6) return false;
    let lo = 0;
    pts.forEach((p, i) => {
        if (p.y > pts[lo].y) lo = i;
    });
    const a = pts[0];
    const m = pts[lo];
    const z = pts[pts.length - 1];
    const fall = m.y - a.y;
    const rise = m.y - z.y;
    return fall > 12 && rise > fall * 0.9 && z.x - a.x > 40 && m.x >= a.x - 10 && z.x > m.x;
}
