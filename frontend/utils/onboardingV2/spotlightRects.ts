export type Rect = { x: number; y: number; width: number; height: number };

export type SpotlightBands = {
    top: Rect | null;
    bottom: Rect | null;
    left: Rect | null;
    right: Rect | null;
    hole: Rect;
};

const orNull = (r: Rect): Rect | null => (r.width > 0 && r.height > 0 ? r : null);

/** Four bands tiling `container` around a padded, container-clamped hole. */
export function spotlightBands(container: Rect, target: Rect, padding: number): SpotlightBands {
    const cx2 = container.x + container.width;
    const cy2 = container.y + container.height;
    const x1 = Math.min(cx2, Math.max(container.x, target.x - padding));
    const y1 = Math.min(cy2, Math.max(container.y, target.y - padding));
    const x2 = Math.min(cx2, Math.max(x1, target.x + target.width + padding));
    const y2 = Math.min(cy2, Math.max(y1, target.y + target.height + padding));
    const hole: Rect = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };

    return {
        top: orNull({ x: container.x, y: container.y, width: container.width, height: y1 - container.y }),
        bottom: orNull({ x: container.x, y: y2, width: container.width, height: cy2 - y2 }),
        left: orNull({ x: container.x, y: y1, width: x1 - container.x, height: hole.height }),
        right: orNull({ x: x2, y: y1, width: cx2 - x2, height: hole.height }),
        hole,
    };
}
