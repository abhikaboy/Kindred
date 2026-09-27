import { describe, expect, it } from "vitest";
import type { CategoryDocument, TaskDocument } from "@/hooks/useWorkspaces";
import { groupTasksByDay } from "./groupByDay";

const task = (id: string, extra: Partial<TaskDocument> = {}) => ({ id, content: id, ...extra }) as TaskDocument;

describe("groupTasksByDay", () => {
  it("skips phantom tasks", () => {
    const categories = [
      {
        id: "c",
        name: "Cat",
        tasks: [task("real", { deadline: "2026-01-05T12:00:00Z" }), task("ghost", { isPhantom: true })],
      },
    ] as CategoryDocument[];
    const groups = groupTasksByDay(categories);
    expect(groups.flatMap((g) => g.tasks.map((t) => t.task.id))).toEqual(["real"]);
  });

  it("puts undated tasks last and keeps the category id", () => {
    const categories = [
      { id: "c1", name: "A", tasks: [task("none")] },
      { id: "c2", name: "B", tasks: [task("dated", { startDate: "2026-01-05T12:00:00Z" })] },
    ] as CategoryDocument[];
    const groups = groupTasksByDay(categories);
    expect(groups.map((g) => g.key)).toEqual(["2026-01-05", "no-date"]);
    expect(groups[0].tasks[0].categoryId).toBe("c2");
  });
});
