export interface CategoryRect {
    categoryId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    // Scroll offset of the list when this rect was measured. Lets hit-testing
    // correct for scrolling (incl. auto-scroll) without re-measuring every frame.
    scrollYAtMeasure?: number;
}

// How far above/below a category (in px) still counts as "on" it, so releasing
// in the gap between two stacked categories snaps to the nearer one instead of
// falling into a dead zone.
const VERTICAL_SLACK = 28;

/**
 * Returns the categoryId at (pointX, pointY). First tries strict containment;
 * if the point lands in a gap between categories, snaps to the vertically
 * nearest category within VERTICAL_SLACK. Coordinates are in window space.
 */
export function categoryAtPoint(
    rects: CategoryRect[],
    pointX: number,
    pointY: number
): string | null {
    for (const r of rects) {
        if (
            pointX >= r.x &&
            pointX <= r.x + r.width &&
            pointY >= r.y &&
            pointY <= r.y + r.height
        ) {
            return r.categoryId;
        }
    }

    // Gap-tolerant fallback: among categories whose horizontal span contains the
    // finger (single-column list), pick the one with the smallest vertical gap.
    let best: string | null = null;
    let bestDist = Infinity;
    for (const r of rects) {
        if (pointX < r.x || pointX > r.x + r.width) continue;
        const dy =
            pointY < r.y ? r.y - pointY : pointY > r.y + r.height ? pointY - (r.y + r.height) : 0;
        if (dy < bestDist) {
            bestDist = dy;
            best = r.categoryId;
        }
    }
    return bestDist <= VERTICAL_SLACK ? best : null;
}

export type DropRect = { key: string; x: number; y: number; width: number; height: number };

/** Strict-containment hit test for tiled drop targets (day cells). */
export function rectAtPoint(rects: DropRect[], x: number, y: number): string | null {
    for (const r of rects) {
        if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) return r.key;
    }
    return null;
}
