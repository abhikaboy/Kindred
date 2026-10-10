import { layoutCoach, type CoachLayout } from "@/utils/onboardingV2/coachLayout";
import type { Rect } from "@/utils/onboardingV2/spotlightRects";

const WINDOW: Rect = { x: 0, y: 0, width: 390, height: 844 };
const SAFE = { top: 59, bottom: 34 };
const GAP = 12;
const CUE_SIZE = { width: 40, height: 28 };

const TARGETS: Record<string, Rect | null> = {
    top: { x: 300, y: 80, width: 40, height: 40 },
    middle: { x: 100, y: 400, width: 190, height: 80 },
    bottom: { x: 100, y: 700, width: 190, height: 40 },
    left: { x: 0, y: 300, width: 40, height: 40 },
    right: { x: 350, y: 300, width: 40, height: 40 },
    tiny: { x: 195, y: 420, width: 1, height: 1 },
    huge: { x: 0, y: 0, width: 390, height: 844 },
    tall: { x: 20, y: 70, width: 350, height: 700 },
    offTop: { x: 100, y: -30, width: 100, height: 100 },
    offBottom: { x: 100, y: 800, width: 100, height: 100 },
    offLeft: { x: -60, y: 400, width: 100, height: 60 },
    offScreen: { x: 500, y: 1000, width: 50, height: 50 },
    zero: { x: 100, y: 100, width: 0, height: 0 },
    null: null,
};
const CARD_HEIGHTS = [110, 140, 200];
const KEYBOARDS = [null, 544];
const CUES = [null, "up", "down"] as const;

const intersects = (a: Rect, b: Rect) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const area = (keyboardTop: number | null) => ({
    top: SAFE.top,
    bottom: Math.min(WINDOW.height - SAFE.bottom, keyboardTop ?? Infinity),
});

const inside = (r: Rect, keyboardTop: number | null) => {
    const a = area(keyboardTop);
    return r.x >= 0 && r.x + r.width <= WINDOW.width && r.y >= a.top && r.y + r.height <= a.bottom;
};

type Case = { name: string; out: CoachLayout; target: Rect | null; kb: number | null; cue: "up" | "down" | null };
const cases: Case[] = [];
for (const [tn, target] of Object.entries(TARGETS))
    for (const h of CARD_HEIGHTS)
        for (const kb of KEYBOARDS)
            for (const cue of CUES) {
                const out = layoutCoach({
                    window: WINDOW,
                    safeArea: SAFE,
                    keyboardTop: kb,
                    target,
                    cardSize: { width: 366, height: h },
                    cue: { kind: cue, size: CUE_SIZE },
                    gap: GAP,
                });
                cases.push({ name: `${tn} h${h} kb${kb} cue${cue}`, out, target, kb, cue });
            }

describe("layoutCoach contract", () => {
    test("grid size", () => {
        expect(cases).toHaveLength(Object.keys(TARGETS).length * CARD_HEIGHTS.length * KEYBOARDS.length * CUES.length);
    });

    test.each(cases.map((c) => [c.name, c] as const))("%s", (_name, { out, target, kb, cue }) => {
        const { card, cue: cueRect, sharp } = out;
        expect(inside(card, kb)).toBe(true);
        if (cueRect) expect(inside(cueRect, kb)).toBe(true);
        if (sharp) {
            expect(intersects(card, sharp)).toBe(false);
            expect(intersects(card, target as Rect)).toBe(false);
            expect(sharp.x).toBeGreaterThanOrEqual(0);
            expect(sharp.y).toBeGreaterThanOrEqual(0);
        }
        if (cueRect) {
            expect(intersects(cueRect, card)).toBe(false);
            if (sharp) expect(intersects(cueRect, sharp)).toBe(false);
            // An "up" cue is above the card; a "down" cue is below it.
            if (cue === "up") expect(cueRect.y + cueRect.height).toBeLessThanOrEqual(card.y);
            if (cue === "down") expect(cueRect.y).toBeGreaterThanOrEqual(card.y + card.height);
            expect(sharp).not.toBeNull();
        }
        if (!sharp) expect(cueRect).toBeNull();
        if (cue === null) expect(cueRect).toBeNull();
        // The card keeps its requested size.
        expect(card.width).toBe(366);
    });

    test("null, zero-size and off-screen targets fall back to the same deterministic placement", () => {
        const base = layoutCoach({ window: WINDOW, safeArea: SAFE, keyboardTop: null, target: null, cardSize: { width: 366, height: 140 }, cue: { kind: "up", size: CUE_SIZE }, gap: GAP });
        const off = layoutCoach({ window: WINDOW, safeArea: SAFE, keyboardTop: null, target: TARGETS.offScreen, cardSize: { width: 366, height: 140 }, cue: { kind: "up", size: CUE_SIZE }, gap: GAP });
        expect(off).toEqual(base);
        expect(base.sharp).toBeNull();
        expect(base.cue).toBeNull();
        expect(base.card.y).toBe(844 * 0.6 - 70);
    });

    test("a bottom target gets the card above it and an up cue above the card", () => {
        const out = layoutCoach({ window: WINDOW, safeArea: SAFE, keyboardTop: null, target: TARGETS.bottom, cardSize: { width: 366, height: 110 }, cue: { kind: "up", size: CUE_SIZE }, gap: GAP });
        expect(out.card.y + out.card.height + GAP).toBe(700);
        expect(out.cue).not.toBeNull();
    });

    test("a top target gets the card below it and an up cue between them, aligned to the target", () => {
        const out = layoutCoach({ window: WINDOW, safeArea: SAFE, keyboardTop: null, target: TARGETS.top, cardSize: { width: 366, height: 110 }, cue: { kind: "up", size: CUE_SIZE }, gap: GAP });
        const cueRect = out.cue as Rect;
        expect(cueRect.y).toBe(120 + GAP);
        expect(cueRect.x + cueRect.width / 2).toBe(320);
        expect(out.card.y).toBe(cueRect.y + cueRect.height + GAP);
    });
});
