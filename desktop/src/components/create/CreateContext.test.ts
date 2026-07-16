import { describe, expect, it } from "vitest";
import { shortcutCategoryIndex } from "@/components/create/CreateContext";

describe("shortcutCategoryIndex", () => {
  it("maps Digit1..9 to 0-based category indices", () => {
    expect(shortcutCategoryIndex("Digit1")).toBe(0);
    expect(shortcutCategoryIndex("Digit2")).toBe(1);
    expect(shortcutCategoryIndex("Digit9")).toBe(8);
  });

  it("returns null for Digit0, letters, and numpad keys", () => {
    expect(shortcutCategoryIndex("Digit0")).toBeNull();
    expect(shortcutCategoryIndex("KeyC")).toBeNull();
    expect(shortcutCategoryIndex("Numpad2")).toBeNull();
  });
});
