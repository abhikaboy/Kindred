import { describe, it, expect } from "vitest";
import { hitTest, type DropRect } from "./dragHitTest";

const rect = (key: string, x: number, y: number): DropRect => ({ key, left: x, top: y, right: x + 10, bottom: y + 10 });

describe("hitTest", () => {
  const rects = [rect("a", 0, 0), rect("b", 100, 0)];
  it("returns the key under the point", () => {
    expect(hitTest({ x: 5, y: 5 }, rects)).toBe("a");
    expect(hitTest({ x: 105, y: 5 }, rects)).toBe("b");
  });
  it("returns null when the point is outside every rect", () => {
    expect(hitTest({ x: 50, y: 50 }, rects)).toBeNull();
  });
  it("prefers the last-registered rect on overlap (topmost)", () => {
    const overlap = [rect("under", 0, 0), rect("over", 0, 0)];
    expect(hitTest({ x: 5, y: 5 }, overlap)).toBe("over");
  });
});
