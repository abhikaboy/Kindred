import { describe, it, expect } from "vitest";
import { buildReactionGroups, segmentCaption } from "@/lib/feed";

describe("buildReactionGroups", () => {
    const reactions = { "👍": ["u1", "u2"], "🔥": ["u2"], "😢": [] };

    it("drops empty groups and detects mine", () => {
        const groups = buildReactionGroups(reactions, "u2");
        expect(groups).toHaveLength(2);
        expect(groups[0]).toEqual({ emoji: "👍", count: 2, ids: ["u1", "u2"], mine: true });
        expect(groups[1]).toEqual({ emoji: "🔥", count: 1, ids: ["u2"], mine: true });
    });

    it("mine is false without myId", () => {
        const groups = buildReactionGroups(reactions);
        expect(groups.every((g) => g.mine === false)).toBe(true);
    });

    it("returns [] for empty or undefined input", () => {
        expect(buildReactionGroups({})).toEqual([]);
        expect(buildReactionGroups(undefined)).toEqual([]);
    });
});

describe("segmentCaption", () => {
    it("splits text and @mention segments with trailing punctuation as text", () => {
        expect(segmentCaption("gg @jane nice @sam_1!")).toEqual([
            { text: "gg ", mention: false },
            { text: "@jane", mention: true },
            { text: " nice ", mention: false },
            { text: "@sam_1", mention: true },
            { text: "!", mention: false },
        ]);
    });

    it("returns a single text segment when there is no mention", () => {
        expect(segmentCaption("just a plain caption")).toEqual([
            { text: "just a plain caption", mention: false },
        ]);
    });

    it("handles a leading mention", () => {
        expect(segmentCaption("@jane hi")).toEqual([
            { text: "@jane", mention: true },
            { text: " hi", mention: false },
        ]);
    });
});
