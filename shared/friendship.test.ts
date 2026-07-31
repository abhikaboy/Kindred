import { describe, expect, it } from "vitest";
import { friendshipLevel, friendshipProgress, MAX_FRIENDSHIP_LEVEL } from "./friendship";

describe("friendshipLevel", () => {
    it("maps scores to levels at the boundaries", () => {
        expect(friendshipLevel(0).level).toBe(1);
        expect(friendshipLevel(24).level).toBe(1);
        expect(friendshipLevel(25).level).toBe(2);
        expect(friendshipLevel(74).level).toBe(2);
        expect(friendshipLevel(75).level).toBe(3);
        expect(friendshipLevel(150).level).toBe(4);
        expect(friendshipLevel(300).level).toBe(MAX_FRIENDSHIP_LEVEL);
        expect(friendshipLevel(99999).level).toBe(MAX_FRIENDSHIP_LEVEL);
    });

    it("survives junk input", () => {
        expect(friendshipLevel(-5).level).toBe(1);
        expect(friendshipLevel(NaN).level).toBe(1);
    });

    it("reports next threshold, null at max", () => {
        expect(friendshipLevel(0).next).toBe(25);
        expect(friendshipLevel(300).next).toBeNull();
    });
});

describe("friendshipProgress", () => {
    it("is 0 at a floor and approaches 1 before the next level", () => {
        expect(friendshipProgress(25)).toBe(0);
        expect(friendshipProgress(50)).toBe(0.5);
        expect(friendshipProgress(74)).toBeCloseTo(0.98, 2);
    });

    it("is 1 at max level", () => {
        expect(friendshipProgress(500)).toBe(1);
    });
});
