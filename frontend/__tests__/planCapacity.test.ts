import { isDayFull, tasksOnDay, taskMoment, PLAN_DAY_CAPACITY } from "@/utils/planCapacity";
import type { Task } from "@/api/types";

const task = (id: string, extra: Partial<Task> = {}): Task =>
    ({ id, content: id, priority: 1, value: 1, recurring: false, public: false, active: false, timestamp: "", lastEdited: "", ...extra }) as Task;

const day = new Date(2026, 8, 29, 12);
const on = (h: number) => new Date(2026, 8, 29, h).toISOString();
const offDay = new Date(2026, 8, 30, 9).toISOString();

describe("planCapacity", () => {
    it("reads the plan time before the start time", () => {
        expect(taskMoment(task("a", { startTime: offDay, plan: { step: "s", size: "2m", at: on(9) } }))?.getDate()).toBe(29);
        expect(taskMoment(task("b"))).toBeNull();
        expect(taskMoment(task("c", { startTime: "nope" }))).toBeNull();
    });

    it("counts timed and planned tasks on the day", () => {
        const all = [task("a", { startTime: on(9) }), task("b", { plan: { step: "s", size: "10m", at: on(18) } }), task("c", { startTime: offDay }), task("d")];
        expect(tasksOnDay(all, day).map((t) => t.id)).toEqual(["a", "b"]);
    });

    it("skips parked, released, completed, duplicates and the task being planned", () => {
        const all = [
            task("a", { startTime: on(9) }),
            task("a", { startTime: on(9) }),
            task("b", { startTime: on(10), parkedAt: on(8) }),
            task("c", { startTime: on(11), releasedAt: on(8) }),
            task("d", { startTime: on(12), timeCompleted: on(12) }),
            task("self", { startTime: on(13) }),
        ];
        expect(tasksOnDay(all, day, "self").map((t) => t.id)).toEqual(["a"]);
    });

    it("is full at the capacity", () => {
        const all = Array.from({ length: PLAN_DAY_CAPACITY }, (_, i) => task(`t${i}`, { startTime: on(9 + i) }));
        expect(isDayFull(all, day)).toBe(true);
        expect(isDayFull(all.slice(1), day)).toBe(false);
        expect(isDayFull(all, day, "t0")).toBe(false);
    });
});
