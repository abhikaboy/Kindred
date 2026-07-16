import { describe, it, expect } from "vitest";
import { startOfWeek } from "date-fns";
import { tasksForWeek } from "./weekTasks";
import { dayKey } from "@/lib/taskCountsByDay";
import type { TaskDocument } from "@/hooks/useWorkspaces";

const task = (o: Partial<TaskDocument>): TaskDocument =>
  ({ id: "t", content: "x", active: false, posted: false, priority: 0, public: false, recurring: false, value: 1, startDate: "", lastEdited: "", timestamp: "", ...o } as TaskDocument);
const iso = (y: number, m: number, d: number, h = 0) => new Date(y, m, d, h).toISOString();

describe("tasksForWeek", () => {
  const weekStart = startOfWeek(new Date(2026, 6, 15)); // Sun 2026-07-12
  it("bins a timed task into that day's timed list", () => {
    const w = tasksForWeek([task({ id: "a", startTime: iso(2026, 6, 15, 9) })], weekStart);
    expect(w[dayKey(new Date(2026, 6, 15))].timed.map((t) => t.id)).toEqual(["a"]);
  });
  it("bins a dated-but-untimed task into that day's allDay list", () => {
    const w = tasksForWeek([task({ id: "b", startDate: iso(2026, 6, 14) })], weekStart);
    expect(w[dayKey(new Date(2026, 6, 14))].allDay.map((t) => t.id)).toEqual(["b"]);
    expect(w[dayKey(new Date(2026, 6, 14))].timed).toHaveLength(0);
  });
  it("excludes tasks outside the week", () => {
    const w = tasksForWeek([task({ id: "c", startTime: iso(2026, 6, 25, 9) })], weekStart);
    const total = Object.values(w).reduce((n, d) => n + d.timed.length + d.allDay.length, 0);
    expect(total).toBe(0);
  });
});
