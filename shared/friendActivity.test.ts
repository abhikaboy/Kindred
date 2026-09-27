import { describe, expect, it } from "vitest";
import {
    activityStatus,
    buildOptions,
    getActivity,
    groupByActivity,
    shortElapsed,
    type Activity,
    type ActivityProfile,
    type ActivityRings,
    type ActivityTask,
} from "./friendActivity";

const NOW = new Date(2026, 8, 27, 15, 0, 0);
const at = (h: number, m = 0) => new Date(2026, 8, 27, h, m, 0).toISOString();
const yesterday = new Date(2026, 8, 26, 15, 0, 0).toISOString();

const task = (id: string, over: Partial<ActivityTask> = {}): ActivityTask => ({ id, content: id, ...over });
const rings = (plan: boolean, doR: boolean, share: boolean): ActivityRings => ({
    all_closed: plan && doR && share,
    plan: { closed: plan },
    do: { closed: doR },
    share: { closed: share },
});

describe("shortElapsed", () => {
    it("formats minutes and hours", () => {
        expect(shortElapsed(undefined, NOW)).toBe("");
        expect(shortElapsed(NOW.toISOString(), NOW)).toBe("just now");
        expect(shortElapsed(at(14, 48), NOW)).toBe("12m");
        expect(shortElapsed(at(12, 10), NOW)).toBe("2h");
    });

    it("clamps future times to just now", () => {
        expect(shortElapsed(at(16), NOW)).toBe("just now");
    });
});

describe("getActivity", () => {
    it("prefers a working task, using workingOnSince then startedAt", () => {
        const p: ActivityProfile = {
            tasks: [task("a"), task("b", { active: true, startedAt: at(14) })],
            completed_tasks: [task("c", { timeCompleted: at(14, 30) })],
        };
        expect(getActivity(p, NOW)).toEqual({ kind: "working", task: p.tasks![1], since: at(14) });
        const q: ActivityProfile = { tasks: [task("d", { workingOnSince: at(13), startedAt: at(12) })] };
        expect(getActivity(q, NOW)).toMatchObject({ kind: "working", since: at(13) });
    });

    it("falls back to the latest task completed today", () => {
        const p: ActivityProfile = {
            completed_tasks: [
                task("old", { timeCompleted: yesterday }),
                task("early", { timeCompleted: at(9) }),
                task("late", { timeCompleted: at(13) }),
            ],
        };
        expect(getActivity(p, NOW)).toMatchObject({ kind: "finished", task: { id: "late" }, since: at(13) });
    });

    it("is idle otherwise", () => {
        expect(getActivity(undefined, NOW)).toEqual({ kind: "idle" });
        expect(getActivity({ completed_tasks: [task("x", { timeCompleted: yesterday })] }, NOW)).toEqual({ kind: "idle" });
    });
});

describe("activityStatus", () => {
    it("describes each state", () => {
        expect(activityStatus({ kind: "working", task: task("Essay"), since: at(14, 48) }, undefined, NOW)).toBe("Working on Essay · for 12m");
        expect(activityStatus({ kind: "working", task: task("Essay") }, undefined, NOW)).toBe("Working on Essay");
        expect(activityStatus({ kind: "finished", task: task("Run"), since: at(13) }, undefined, NOW)).toBe("Finished Run · 2h ago");
        expect(activityStatus({ kind: "idle" }, rings(true, true, true), NOW)).toBe("Closed every ring today");
        expect(activityStatus({ kind: "idle" }, rings(true, false, true), NOW)).toBe("Quiet so far today");
    });
});

describe("groupByActivity", () => {
    it("orders working > finished > idle, newest first, and drops empty sections", () => {
        const row = (id: string, activity: Activity) => ({ id, activity });
        const sections = groupByActivity([
            row("idle", { kind: "idle" }),
            row("f-old", { kind: "finished", task: task("x"), since: at(9) }),
            row("w-old", { kind: "working", task: task("x"), since: at(10) }),
            row("f-new", { kind: "finished", task: task("x"), since: at(14) }),
            row("w-new", { kind: "working", task: task("x"), since: at(14) }),
        ]);
        expect(sections.map((s) => [s.title, s.data.map((r) => r.id)])).toEqual([
            ["Active now", ["w-new", "w-old"]],
            ["Earlier today", ["f-new", "f-old"]],
            [null, ["idle"]],
        ]);
        expect(groupByActivity([row("idle", { kind: "idle" })]).map((s) => s.kind)).toEqual(["idle"]);
    });
});

describe("buildOptions", () => {
    it("nudges up to 2 working, 2 pending, then each open ring", () => {
        const p: ActivityProfile = {
            tasks: [
                task("w1", { active: true }),
                task("w2", { workingOnSince: at(14) }),
                task("w3", { active: true }),
                task("p1"),
                task("p2"),
                task("p3"),
                task("done", { timeCompleted: at(12) }),
            ],
            ring_state: rings(true, false, false),
        };
        const opts = buildOptions("nudge", p, NOW);
        expect(opts.map((o) => [o.id, o.label, o.message])).toEqual([
            ["task-w1", "Keep going on w1", "You've got this, keep going!"],
            ["task-w2", "Keep going on w2", "You've got this, keep going!"],
            ["task-p1", "Finish p1", "Go knock this one out!"],
            ["task-p2", "Finish p2", "Go knock this one out!"],
            ["ring-do", "Get their tasks done", "Finish up those tasks, you're almost there!"],
            ["ring-share", "Share something", "Post something or send some kudos to close the ring!"],
        ]);
        expect(opts[0].task?.id).toBe("w1");
        expect(opts[4].ring).toBe("do");
    });

    it("congratulates up to 3 tasks completed today plus closed rings", () => {
        const p: ActivityProfile = {
            completed_tasks: ["a", "b", "c", "d"].map((id) => task(id, { timeCompleted: at(12) })).concat(task("y", { timeCompleted: yesterday })),
            ring_state: rings(true, false, true),
        };
        const opts = buildOptions("congratulate", p, NOW);
        expect(opts.map((o) => [o.id, o.label, o.message, o.taskName])).toEqual([
            ["task-a", "Finishing a", "Nice work getting that done!", "a"],
            ["task-b", "Finishing b", "Nice work getting that done!", "b"],
            ["task-c", "Finishing c", "Nice work getting that done!", "c"],
            ["ring-plan", "Closing their Plan ring", "Way to close your Plan ring!", "Plan ring"],
            ["ring-share", "Closing their Share ring", "Way to close your Share ring!", "Share ring"],
        ]);
    });

    it("collapses to a single all-rings option when every ring is closed", () => {
        const opts = buildOptions("congratulate", { ring_state: rings(true, true, true) }, NOW);
        expect(opts).toEqual([
            { id: "ring-all", label: "Closing every ring", message: "Every ring closed today. Incredible!", variant: "all", taskName: "Closing every ring" },
        ]);
    });

    it("returns nothing to congratulate for an empty profile", () => {
        expect(buildOptions("congratulate", undefined, NOW)).toEqual([]);
        expect(buildOptions("nudge", undefined, NOW)).toEqual([]);
    });
});
