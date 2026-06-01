import { moveTaskInWorkspaces } from "@/utils/moveTask";
import { Workspace, Task, Categories } from "@/api/types";

const task = (id: string, content = ""): Task =>
    ({ id, content, priority: 1 } as Task);

const cat = (id: string, name: string, tasks: Task[]): Categories =>
    ({ id, name, tags: [], tasks });

const ws = (categories: Categories[]): Workspace =>
    ({ name: "W", categories, isBlueprint: false } as Workspace);

describe("moveTaskInWorkspaces", () => {
    it("removes the task from source and puts it at the top of target", () => {
        const input = [
            ws([
                cat("src", "Source", [task("t1", "move me"), task("t2")]),
                cat("dst", "Target", [task("t3")]),
            ]),
        ];
        const out = moveTaskInWorkspaces(input, "src", "t1", "dst");
        const src = out[0].categories.find((c) => c.id === "src")!;
        const dst = out[0].categories.find((c) => c.id === "dst")!;
        expect(src.tasks.map((t) => t.id)).toEqual(["t2"]);
        expect(dst.tasks.map((t) => t.id)).toEqual(["t1", "t3"]);
    });

    it("does not mutate the input", () => {
        const input = [ws([cat("src", "S", [task("t1")]), cat("dst", "D", [])])];
        const snapshot = JSON.stringify(input);
        moveTaskInWorkspaces(input, "src", "t1", "dst");
        expect(JSON.stringify(input)).toEqual(snapshot);
    });

    it("is a no-op when source and target are the same", () => {
        const input = [ws([cat("src", "S", [task("t1")])])];
        const out = moveTaskInWorkspaces(input, "src", "t1", "src");
        expect(out).toBe(input);
    });

    it("returns the input unchanged when the task is not found", () => {
        const input = [ws([cat("src", "S", []), cat("dst", "D", [])])];
        const out = moveTaskInWorkspaces(input, "src", "missing", "dst");
        expect(out).toBe(input);
    });
});
