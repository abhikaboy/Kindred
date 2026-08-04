import { friendshipFeedback } from "@/utils/friendship";

describe("friendshipFeedback", () => {
    it("shows the points gained on a normal bump", () => {
        expect(friendshipFeedback({ score: 30, delta: 3, leveledUp: false })).toBe("Friendship +3");
    });

    it("shows the new level name on a level up", () => {
        expect(friendshipFeedback({ score: 75, delta: 2, leveledUp: true })).toBe("Now good friends");
    });
});
