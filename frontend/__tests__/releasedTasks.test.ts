jest.mock("@/contexts/tasksContext", () => ({ useTasks: () => ({}) }));
jest.mock("@/hooks/useAnalytics", () => ({ useAnalytics: () => ({ capture: jest.fn() }) }));
jest.mock("@/utils/showToast", () => ({ showToast: jest.fn() }));
jest.mock("@/api/plan", () => ({}));

import { fogReleaseItems, releasedAgoLabel, sortReleasedNewestFirst } from "@/hooks/useReleasedTasks";

const now = new Date(2026, 8, 28, 12);
const daysAgo = (n: number) => new Date(2026, 8, 28 - n, 9).toISOString();

describe("releasedAgoLabel", () => {
    it.each([
        [0, "Released today"],
        [1, "Released yesterday"],
        [3, "Released 3 days ago"],
        [7, "Released a week ago"],
        [16, "Released 2 weeks ago"],
        [45, "Released a month ago"],
        [400, "Released over a year ago"],
    ])("%i days ago", (n, label) => {
        expect(releasedAgoLabel(daysAgo(n), now)).toBe(label);
    });

    it("falls back when missing or invalid", () => {
        expect(releasedAgoLabel(undefined, now)).toBe("Released");
        expect(releasedAgoLabel("nope", now)).toBe("Released");
    });
});

describe("sortReleasedNewestFirst", () => {
    it("orders newest first and puts undated last", () => {
        const out = sortReleasedNewestFirst([
            { id: "a", releasedAt: daysAgo(5) },
            { id: "b", releasedAt: null },
            { id: "c", releasedAt: daysAgo(1) },
        ]);
        expect(out.map((t) => t.id)).toEqual(["c", "a", "b"]);
    });
});

describe("fogReleaseItems", () => {
    it("releases ticked tasks only", () => {
        const items = fogReleaseItems(
            [
                { id: "1", categoryID: "x" },
                { id: "2", categoryID: "y" },
                { id: "3" },
            ],
            new Set(["2"])
        );
        expect(items).toEqual([{ categoryId: "x", taskId: "1" }]);
    });
});
