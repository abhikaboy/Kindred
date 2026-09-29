import { isCheck, type Point } from "@/utils/checkGesture";

const line = (from: Point, to: Point, n = 5): Point[] =>
    Array.from({ length: n }, (_, i) => ({ x: from.x + ((to.x - from.x) * i) / (n - 1), y: from.y + ((to.y - from.y) * i) / (n - 1) }));

describe("isCheck", () => {
    it("accepts a down-then-up stroke moving right", () => {
        expect(isCheck([...line({ x: 50, y: 60 }, { x: 86, y: 94 }), ...line({ x: 90, y: 90 }, { x: 150, y: 30 })])).toBe(true);
    });

    it("rejects too few points", () => {
        expect(isCheck(line({ x: 0, y: 0 }, { x: 100, y: 0 }, 5))).toBe(false);
    });

    it("rejects a flat line", () => {
        expect(isCheck(line({ x: 0, y: 50 }, { x: 200, y: 50 }, 10))).toBe(false);
    });

    it("rejects a stroke that never rises back", () => {
        expect(isCheck([...line({ x: 50, y: 30 }, { x: 90, y: 90 }), ...line({ x: 95, y: 88 }, { x: 150, y: 80 })])).toBe(false);
    });

    it("rejects a check drawn right to left", () => {
        expect(isCheck([...line({ x: 150, y: 60 }, { x: 114, y: 94 }), ...line({ x: 110, y: 90 }, { x: 50, y: 30 })])).toBe(false);
    });

    it("rejects a stroke too narrow to be a check", () => {
        expect(isCheck([...line({ x: 50, y: 60 }, { x: 60, y: 94 }), ...line({ x: 62, y: 90 }, { x: 80, y: 30 })])).toBe(false);
    });
});
