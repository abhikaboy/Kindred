jest.mock("@react-native-async-storage/async-storage", () => ({ getItem: jest.fn(), setItem: jest.fn() }));

import { nudgeCopy, pickCandidate, shouldPrompt } from "@/utils/postCompletionNudge";

const friend = (id: string) => ({ _id: id, display_name: id, handle: id, profile_picture: "" }) as any;
const task = (id: string, extra: object = {}) => ({ id, content: `task ${id}`, ...extra }) as any;
const now = new Date("2026-10-06T12:00:00Z");

describe("shouldPrompt", () => {
    it("respects the base chance with no history", () => {
        expect(shouldPrompt({ level: 0 }, now, 0.1)).toBe(true);
        expect(shouldPrompt({ level: 0 }, now, 0.5)).toBe(false);
    });

    it("holds off during the cooldown", () => {
        const lastShownAt = new Date(now.getTime() - 3600000).toISOString();
        expect(shouldPrompt({ level: 0, lastShownAt }, now, 0)).toBe(false);
    });

    it("gets rarer at higher levels", () => {
        expect(shouldPrompt({ level: 2 }, now, 0.1)).toBe(false);
        expect(shouldPrompt({ level: 2 }, now, 0.05)).toBe(true);
        const lastShownAt = new Date(now.getTime() - 24 * 3600000).toISOString();
        expect(shouldPrompt({ level: 2, lastShownAt }, now, 0)).toBe(false);
    });
});

describe("pickCandidate", () => {
    const friends = [friend("a"), friend("b"), friend("c")];

    it("returns null when no friend has open tasks", () => {
        expect(pickCandidate(friends, [{ user_id: "a", tasks: [], completed_tasks: [] }], undefined, 0)).toBeNull();
    });

    it("prefers a friend who is working on something", () => {
        const activity = [
            { user_id: "a", tasks: [task("1")], completed_tasks: [] },
            { user_id: "b", tasks: [task("2"), task("3", { startedAt: "x" })], completed_tasks: [] },
        ];
        const pick = pickCandidate(friends, activity, undefined, 0.99);
        expect(pick?.friend._id).toBe("b");
        expect(pick?.task.id).toBe("3");
    });

    it("avoids the last friend shown when there is another option", () => {
        const activity = [
            { user_id: "a", tasks: [task("1")], completed_tasks: [] },
            { user_id: "b", tasks: [task("2")], completed_tasks: [] },
        ];
        expect(pickCandidate(friends, activity, "a", 0)?.friend._id).toBe("b");
        expect(pickCandidate(friends, activity.slice(0, 1), "a", 0)?.friend._id).toBe("a");
    });
});

describe("nudgeCopy", () => {
    it("has five variants that name the friend and task", () => {
        const titles = new Set([0, 1, 2, 3, 4].map((i) => nudgeCopy("Sam", "Run", i).title));
        expect(titles.size).toBe(5);
        expect(nudgeCopy("Sam", "Run", 0).title).toBe("Give Sam a nudge?");
        expect(nudgeCopy("Sam", "Run", 6).body).toContain("Run");
    });
});

describe("pickCandidate self-encouraged", () => {
    it("skips tasks you already encouraged", () => {
        const activity = [{ user_id: "a", tasks: [task("1", { encouragements: [{ sender: { id: "me" } }] })], completed_tasks: [] }];
        expect(pickCandidate([friend("a")], activity, undefined, 0, "me")).toBeNull();
    });
});
