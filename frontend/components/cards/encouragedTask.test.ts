import { isTaskEncouraged } from "./encouragedTask";
import type { Task } from "@/api/types";

const baseTask = { id: "t1", content: "x" } as unknown as Task;

describe("isTaskEncouraged", () => {
    it("is false when there are no encouragements", () => {
        expect(isTaskEncouraged(baseTask)).toBe(false);
        expect(isTaskEncouraged({ ...baseTask, encouragements: [] })).toBe(false);
        expect(isTaskEncouraged(undefined)).toBe(false);
    });

    it("is true when the task has at least one encouragement", () => {
        const task = {
            ...baseTask,
            encouragements: [
                { encouragementId: "e1", sender: { id: "u1", handle: "@a", name: "A", icon: "" }, message: "hi", timestamp: "", type: "message" },
            ],
        } as Task;
        expect(isTaskEncouraged(task)).toBe(true);
    });
});
