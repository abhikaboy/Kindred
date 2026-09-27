import { describe, it, expect } from "vitest";
import { buildOptions, getActivity, type FriendProfile, type FriendTask } from "@/lib/friendActivity";

// Logic is covered in shared/friendActivity.test.ts; this checks the generated API types plug in.
const task = (over: Partial<FriendTask>): FriendTask => ({
    active: false,
    content: "",
    id: "t",
    lastEdited: "",
    posted: false,
    priority: 0,
    public: false,
    recurring: false,
    startDate: "",
    timestamp: "",
    value: 0,
    ...over,
});

const profile = (over: Partial<FriendProfile>): FriendProfile => ({
    display_name: "",
    friends: [],
    handle: "",
    id: "p",
    points: 0,
    posts_made: 0,
    productivity_score: 0,
    profile_picture: "",
    streak: 0,
    tasks_complete: 0,
    ...over,
});

describe("friendActivity (desktop types)", () => {
    it("returns the full TaskDocument for the working task", () => {
        const t = task({ id: "b", content: "deep work", workingOnSince: "2026-07-15T10:00:00Z", categoryID: "cat1" });
        const activity = getActivity(profile({ tasks: [t] }));
        expect(activity).toEqual({ kind: "working", task: t, since: "2026-07-15T10:00:00Z" });
        expect(buildOptions("nudge", profile({ tasks: [t] }))[0].task?.categoryID).toBe("cat1");
    });
});
