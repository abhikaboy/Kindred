import { describe, expect, it } from "vitest";
import { friendshipToastMessage } from "@/hooks/useFriendshipBump";

describe("friendshipToastMessage", () => {
  it("shows a short points bump when the level holds", () => {
    expect(friendshipToastMessage({ delta: 3, score: 30, leveledUp: false }, "Sarah")).toBe("+3 with Sarah");
  });

  it("announces the new level when the bump crosses a floor", () => {
    expect(friendshipToastMessage({ delta: 2, score: 75, leveledUp: true }, "Sarah")).toBe(
      "You and Sarah are now good friends"
    );
  });

  it("names the max level", () => {
    expect(friendshipToastMessage({ delta: 1, score: 300, leveledUp: true }, "Ravi")).toBe(
      "You and Ravi are now kindred spirits"
    );
  });
});
