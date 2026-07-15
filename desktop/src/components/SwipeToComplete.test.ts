import { describe, expect, it } from "vitest";
import { shouldComplete } from "@/components/SwipeToComplete";

describe("shouldComplete", () => {
  it("fires past 70% of the row width", () => {
    expect(shouldComplete(210, 300)).toBe(true); // 70% of 300 = 210
    expect(shouldComplete(209, 300)).toBe(false);
  });

  it("scales with width — no fixed px cap", () => {
    expect(shouldComplete(700, 1000)).toBe(true); // 70% of 1000 = 700
    expect(shouldComplete(699, 1000)).toBe(false);
    expect(shouldComplete(120, 1000)).toBe(false); // old 120px cap no longer fires early
  });

  it("never fires on zero or negative movement", () => {
    expect(shouldComplete(0, 300)).toBe(false);
    expect(shouldComplete(-50, 300)).toBe(false);
  });
});
