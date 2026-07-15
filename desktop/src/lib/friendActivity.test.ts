import { describe, it, expect } from "vitest";
import { deriveReco } from "@/lib/friendActivity";
import type { components } from "@/lib/api/types.gen";

type ProfileDocument = components["schemas"]["ProfileDocument"];
type TaskDocument = components["schemas"]["TaskDocument"];
type RingProgress = components["schemas"]["RingProgress"];

function task(overrides: Partial<TaskDocument>): TaskDocument {
    return {
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
        ...overrides,
    };
}

function ring(closed: boolean): RingProgress {
    return { closed, current: 0, target: 1 };
}

function profile(overrides: Partial<ProfileDocument>): ProfileDocument {
    return {
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
        ...overrides,
    };
}

function ringState(plan: boolean, doR: boolean, share: boolean): ProfileDocument["ring_state"] {
    return {
        all_closed: plan && doR && share,
        created_at: "",
        date: "",
        do: ring(doR),
        id: "r",
        plan: ring(plan),
        reward_claimed: false,
        share: ring(share),
        updated_at: "",
        user_id: "u",
    };
}

describe("deriveReco", () => {
    it("picks a public+workingOnSince task over a public+active task", () => {
        const p = profile({
            tasks: [
                task({ id: "a", content: "active only", public: true, active: true }),
                task({ id: "b", content: "deep work", public: true, workingOnSince: "2026-07-15T10:00:00Z", categoryID: "cat1" }),
            ],
        });
        expect(deriveReco(p)).toEqual({
            kind: "task",
            label: 'Working on "deep work"',
            task: { id: "b", content: "deep work", categoryId: "cat1" },
        });
    });

    it("falls back to a public+active task with empty categoryId when absent", () => {
        const p = profile({
            tasks: [
                task({ id: "priv", content: "hidden", public: false, active: true }),
                task({ id: "c", content: "emails", public: true, active: true }),
            ],
        });
        expect(deriveReco(p)).toEqual({
            kind: "task",
            label: 'Working on "emails"',
            task: { id: "c", content: "emails", categoryId: "" },
        });
    });

    it("reports 2 open rings when two are not closed", () => {
        const p = profile({ ring_state: ringState(false, false, true) });
        expect(deriveReco(p)).toEqual({ kind: "ring", label: "2 rings left today" });
    });

    it("reports 1 open ring in the singular", () => {
        const p = profile({ ring_state: ringState(true, false, true) });
        expect(deriveReco(p)).toEqual({ kind: "ring", label: "1 ring left today" });
    });

    it("falls back to profile when all rings closed and no tasks", () => {
        const p = profile({ tasks: [], ring_state: ringState(true, true, true) });
        expect(deriveReco(p)).toEqual({ kind: "profile", label: "Brighten their day" });
    });

    it("falls back to profile with no tasks and no ring_state", () => {
        expect(deriveReco(profile({}))).toEqual({ kind: "profile", label: "Brighten their day" });
    });

    it("falls back to profile for undefined", () => {
        expect(deriveReco(undefined)).toEqual({ kind: "profile", label: "Brighten their day" });
    });
});
