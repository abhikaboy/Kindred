import { buildReactionGroups, ReactionGroup } from "@/utils/reactions";
import type { UserExtendedReference } from "@/api/profile";

const user = (id: string, name: string): UserExtendedReference => ({
    _id: id,
    display_name: name,
    handle: name.toLowerCase(),
    profile_picture: `https://x/${id}.png`,
});

describe("buildReactionGroups", () => {
    const usersById = new Map([
        ["a", user("a", "Alice")],
        ["b", user("b", "Bob")],
    ]);

    test("groups reactors by emoji, omitting unresolved IDs", () => {
        const groups = buildReactionGroups(
            [
                { emoji: "❤️", count: 2, ids: ["a", "b"] },
                { emoji: "😂", count: 2, ids: ["a", "missing"] },
            ],
            usersById,
        );
        expect(groups.map((g) => g.emoji)).toEqual(["❤️", "😂"]);
        expect(groups[0].users.map((u) => u._id)).toEqual(["a", "b"]);
        expect(groups[1].users.map((u) => u._id)).toEqual(["a"]); // "missing" omitted
    });

    test("returns empty array for no reactions", () => {
        expect(buildReactionGroups([], usersById)).toEqual([]);
    });
});
