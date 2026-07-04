import { categoryAtPoint, CategoryRect, rectAtPoint, DropRect } from "@/utils/dragHitTest";

const rects: CategoryRect[] = [
    { categoryId: "a", x: 0, y: 0, width: 100, height: 50 },
    { categoryId: "b", x: 0, y: 60, width: 100, height: 50 },
];

describe("categoryAtPoint", () => {
    it("returns the category whose rect contains the point", () => {
        expect(categoryAtPoint(rects, 10, 10)).toBe("a");
        expect(categoryAtPoint(rects, 10, 80)).toBe("b");
    });

    it("returns null when the point is outside every rect", () => {
        expect(categoryAtPoint(rects, 10, 55)).toBeNull();
        expect(categoryAtPoint(rects, 200, 10)).toBeNull();
    });

    it("returns the first matching rect when rects overlap", () => {
        const overlapping: CategoryRect[] = [
            { categoryId: "first", x: 0, y: 0, width: 100, height: 100 },
            { categoryId: "second", x: 0, y: 0, width: 100, height: 100 },
        ];
        expect(categoryAtPoint(overlapping, 50, 50)).toBe("first");
    });
});

describe("rectAtPoint", () => {
    const dropRects: DropRect[] = [
        { key: "2026-07-01", x: 0, y: 100, width: 50, height: 50 },
        { key: "2026-07-02", x: 50, y: 100, width: 50, height: 50 },
    ];
    it("returns the containing rect's key", () => {
        expect(rectAtPoint(dropRects, 60, 120)).toBe("2026-07-02");
    });
    it("returns null outside all rects — no slack", () => {
        expect(rectAtPoint(dropRects, 60, 200)).toBeNull();
    });
});
