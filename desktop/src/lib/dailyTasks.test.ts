import { describe, it, expect } from "vitest";
import { categorizeDailyTasks } from "./dailyTasks";
import type { TaskDocument } from "@/hooks/useWorkspaces";

const task = (over: Partial<TaskDocument>): TaskDocument =>
  ({ id: over.id ?? "t", content: "x", active: false, posted: false, priority: 0, public: false, recurring: false, value: 1, startDate: "", lastEdited: "", timestamp: "", ...over } as TaskDocument);

const iso = (y: number, m: number, d: number, h = 0) => new Date(y, m, d, h).toISOString();

describe("categorizeDailyTasks", () => {
  const selected = new Date(2026, 6, 15);

  it("puts a task with startTime on the selected day into tasksWithSpecificTime", () => {
    const t = task({ startDate: iso(2026, 6, 15), startTime: iso(2026, 6, 15, 9) });
    const b = categorizeDailyTasks([t], selected);
    expect(b.tasksWithSpecificTime).toHaveLength(1);
    expect(b.tasksForTodayNoTime).toHaveLength(0);
  });

  it("treats a task with only startDate on the day as no-time", () => {
    const t = task({ startDate: iso(2026, 6, 15) });
    const b = categorizeDailyTasks([t], selected);
    expect(b.tasksForTodayNoTime).toHaveLength(1);
    expect(b.tasksWithSpecificTime).toHaveLength(0);
  });

  it("classifies a past deadline as overdue", () => {
    const t = task({ startDate: "", deadline: iso(2026, 6, 1) });
    const b = categorizeDailyTasks([t], selected);
    expect(b.overdueTasks).toHaveLength(1);
  });

  it("classifies a task with no startDate and no deadline as unscheduled", () => {
    const t = task({ startDate: "", deadline: "" });
    const b = categorizeDailyTasks([t], selected);
    expect(b.listUnscheduledTasks).toHaveLength(1);
    expect(b.tasksUnscheduled).toHaveLength(0); // not on selected date at all
  });
});
