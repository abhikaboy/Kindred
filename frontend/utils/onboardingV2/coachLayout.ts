import type { Rect } from "@/utils/onboardingV2/spotlightRects";

export type CueKind = "up" | "down";

export type CoachLayoutArgs = {
    window: Rect;
    safeArea: { top: number; bottom: number };
    /** Window y of the keyboard's top edge, or null when hidden. */
    keyboardTop: number | null;
    /** Window rect of the element the user must use, or null when unknown. */
    target: Rect | null;
    cardSize: { width: number; height: number };
    /** The chevron's direction and size; null kind means no cue. */
    cue: { kind: CueKind | null; size: { width: number; height: number } };
    gap: number;
};

export type CoachLayout = { card: Rect; cue: Rect | null; sharp: Rect | null };

const FALLBACK_CENTER = 0.6;

const bottomOf = (r: Rect) => r.y + r.height;

function clip(r: Rect, bounds: Rect): Rect | null {
    const x1 = Math.max(r.x, bounds.x);
    const y1 = Math.max(r.y, bounds.y);
    const x2 = Math.min(r.x + r.width, bounds.x + bounds.width);
    const y2 = Math.min(bottomOf(r), bottomOf(bounds));
    return x2 > x1 && y2 > y1 ? { x: x1, y: y1, width: x2 - x1, height: y2 - y1 } : null;
}

/**
 * Places the card and cue around the sharp target in window coordinates. By construction the card
 * and cue never intersect the target or each other and stay inside the safe area above the keyboard.
 * The cue sits on its direction's side of the card (between card and target when it points at it)
 * and is dropped when there is no room. With no usable target the card is centered low.
 */
export function layoutCoach({ window, safeArea, keyboardTop, target, cardSize, cue, gap }: CoachLayoutArgs): CoachLayout {
    const areaTop = window.y + safeArea.top;
    const areaBottom = Math.min(bottomOf(window) - safeArea.bottom, keyboardTop ?? Infinity);
    const cardX = window.x + (window.width - cardSize.width) / 2;
    const cardH = cardSize.height;
    const maxTop = Math.max(areaTop, areaBottom - cardH);

    const fallback = (): CoachLayout => ({
        card: {
            x: cardX,
            y: Math.min(maxTop, Math.max(areaTop, window.y + window.height * FALLBACK_CENTER - cardH / 2)),
            width: cardSize.width,
            height: cardH,
        },
        cue: null,
        sharp: null,
    });

    const sharp = target ? clip(target, window) : null;
    if (!sharp) return fallback();

    const cueH = cue.kind ? cue.size.height + gap : 0;
    const areaMid = (areaTop + areaBottom) / 2;
    const preferAbove = sharp.y + sharp.height / 2 > areaMid;
    const sides: ("above" | "below")[] = preferAbove ? ["above", "below"] : ["below", "above"];
    const withCue = cue.kind ? [true, false] : [false];

    for (const useCue of withCue) {
        const extra = useCue ? cueH : 0;
        for (const side of sides) {
            const total = cardH + extra;
            const stackTop = side === "below" ? bottomOf(sharp) + gap : sharp.y - gap - total;
            if (stackTop < areaTop || stackTop + total > areaBottom) continue;

            // Top-down order: an "up" cue sits above the card, a "down" cue below it.
            const cueOnTop = useCue && cue.kind === "up";
            const cardY = stackTop + (cueOnTop ? cueH : 0);
            const cueY = cueOnTop ? stackTop : cardY + cardH + gap;
            const card: Rect = { x: cardX, y: cardY, width: cardSize.width, height: cardH };
            if (!useCue || !cue.kind) return { card, cue: null, sharp };

            const half = cue.size.width / 2;
            const between = (side === "below" && cue.kind === "up") || (side === "above" && cue.kind === "down");
            const aimX = between ? sharp.x + sharp.width / 2 : card.x + card.width / 2;
            const cx = Math.min(window.x + window.width - half, Math.max(window.x + half, aimX));
            return { card, cue: { x: cx - half, y: cueY, width: cue.size.width, height: cue.size.height }, sharp };
        }
    }
    return fallback();
}
