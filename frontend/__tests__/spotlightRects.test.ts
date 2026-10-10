import { spotlightBands, type Rect } from "@/utils/onboardingV2/spotlightRects";

const container: Rect = { x: 0, y: 0, width: 400, height: 800 };
const area = (r: Rect | null) => (r ? r.width * r.height : 0);

describe("spotlightBands", () => {
    test("bands plus hole tile the container", () => {
        const b = spotlightBands(container, { x: 100, y: 200, width: 100, height: 50 }, 8);
        expect(b.hole).toEqual({ x: 92, y: 192, width: 116, height: 66 });
        const total = area(b.top) + area(b.bottom) + area(b.left) + area(b.right) + area(b.hole);
        expect(total).toBe(400 * 800);
        expect(b.top).toEqual({ x: 0, y: 0, width: 400, height: 192 });
        expect(b.bottom).toEqual({ x: 0, y: 258, width: 400, height: 542 });
        expect(b.left).toEqual({ x: 0, y: 192, width: 92, height: 66 });
        expect(b.right).toEqual({ x: 208, y: 192, width: 192, height: 66 });
    });

    test("clamps hole and drops empty bands for a target off the top-left", () => {
        const b = spotlightBands(container, { x: -50, y: -20, width: 100, height: 60 }, 8);
        expect(b.hole).toEqual({ x: 0, y: 0, width: 58, height: 48 });
        expect(b.top).toBeNull();
        expect(b.left).toBeNull();
        const total = area(b.bottom) + area(b.right) + area(b.hole);
        expect(total).toBe(400 * 800);
    });

    test("clamps a target hanging off the bottom-right", () => {
        const b = spotlightBands(container, { x: 350, y: 780, width: 100, height: 100 }, 0);
        expect(b.hole).toEqual({ x: 350, y: 780, width: 50, height: 20 });
        expect(b.bottom).toBeNull();
        expect(b.right).toBeNull();
    });

    test("full-container target yields no bands", () => {
        const b = spotlightBands(container, container, 8);
        expect(b.hole).toEqual(container);
        expect([b.top, b.bottom, b.left, b.right]).toEqual([null, null, null, null]);
    });
});
