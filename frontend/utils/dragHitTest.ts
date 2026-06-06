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

/**
 * Returns the categoryId of the first rect that contains (pointX, pointY),
 * or null if the point is outside every rect. Coordinates are in window space.
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
    return null;
}
