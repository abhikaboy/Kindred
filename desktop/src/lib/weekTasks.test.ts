import { describe, it, expect } from "vitest";
import { startOfWeek } from "date-fns";
import { isMultiDay, tasksForWeek, spanningTasksForWeek, dayKey } from "@/lib/weekTasks";
import type { TaskDocument } from "@/hooks/useWorkspaces";

const task = (o: Partial<TaskDocument>): TaskDocument =>
  ({ id: "t", content: "x", active: false, posted: false, priority: 0, public: false, recurring: false, value: 1, startDate: "", lastEdited: "", timestamp: "", ...o } as TaskDocument);

const iso = (y: number, m: number, d: number, h = 0) => new Date(y, m, d, h).toISOString();

// Week: Sun Jul 12 – Sat Jul 18 2026 (month index 6 = July)
const SUN_JUL12 = new Date(2026, 6, 12);
// Week: Sun Jul 19 – Sat Jul 25 2026
const SUN_JUL19 = new Date(2026, 6, 19);

describe("isMultiDay", () => {
  it("true when start Jul16 9AM, deadline Jul23 5PM", () => {
    const t = task({ startTime: iso(2026, 6, 16, 9), deadline: iso(2026, 6, 23, 17) });
    expect(isMultiDay(t)).toBe(true);
  });

  it("false when start and deadline are on the same calendar day", () => {
    const t = task({ startTime: iso(2026, 6, 16, 9), deadline: iso(2026, 6, 16, 17) });
    expect(isMultiDay(t)).toBe(false);
  });

  it("false when no deadline", () => {
    const t = task({ startTime: iso(2026, 6, 16, 9) });
    expect(isMultiDay(t)).toBe(false);
  });

  it("false when deadline day equals start day even with later time", () => {
    const t = task({ startDate: iso(2026, 6, 16), deadline: iso(2026, 6, 16, 23) });
    expect(isMultiDay(t)).toBe(false);
  });
});

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

  it("excludes a multi-day task from all timed/allDay buckets", () => {
    const multiDay = task({ id: "multi", startTime: iso(2026, 6, 16, 9), deadline: iso(2026, 6, 23, 17) });
    const result = tasksForWeek([multiDay], SUN_JUL12);
    for (const bucket of Object.values(result)) {
      expect(bucket.timed.map((t) => t.id)).not.toContain("multi");
      expect(bucket.allDay.map((t) => t.id)).not.toContain("multi");
    }
  });

  it("still buckets a normal same-day timed task (Thu Jul 16)", () => {
    const timed = task({ id: "timed", startTime: iso(2026, 6, 16, 9), deadline: iso(2026, 6, 16, 10) });
    const result = tasksForWeek([timed], SUN_JUL12);
    expect(result[dayKey(new Date(2026, 6, 16))].timed.map((t) => t.id)).toContain("timed");
  });

  it("still buckets a normal all-day task on its startDate (Fri Jul 17)", () => {
    const allDay = task({ id: "allday", startDate: iso(2026, 6, 17) });
    const result = tasksForWeek([allDay], SUN_JUL12);
    expect(result[dayKey(new Date(2026, 6, 17))].allDay.map((t) => t.id)).toContain("allday");
  });
});

describe("spanningTasksForWeek", () => {
  // Jul 16 (Thu) 9AM → Jul 23 (Thu) 5PM
  const multiDay = task({ id: "multi", startTime: iso(2026, 6, 16, 9), deadline: iso(2026, 6, 23, 17) });

  it("week Sun Jul12–Sat Jul18: startCol=4, endCol=6, clippedLeft=false, clippedRight=true", () => {
    const bars = spanningTasksForWeek([multiDay], SUN_JUL12);
    expect(bars).toHaveLength(1);
    const bar = bars[0];
    expect(bar.startCol).toBe(4); // Thu Jul 16 is 4 days from Sun Jul 12
    expect(bar.endCol).toBe(6);   // Jul 23 is beyond Sat Jul 18, clamped to 6
    expect(bar.clippedLeft).toBe(false);
    expect(bar.clippedRight).toBe(true);
    expect(bar.row).toBe(0);
  });

  it("week Sun Jul19–Sat Jul25: startCol=0, clippedLeft=true, endCol=4, clippedRight=false", () => {
    const bars = spanningTasksForWeek([multiDay], SUN_JUL19);
    expect(bars).toHaveLength(1);
    const bar = bars[0];
    expect(bar.startCol).toBe(0);  // Jul 16 < Jul 19, clamped to 0
    expect(bar.endCol).toBe(4);    // Thu Jul 23 is 4 days from Sun Jul 19
    expect(bar.clippedLeft).toBe(true);
    expect(bar.clippedRight).toBe(false);
    expect(bar.row).toBe(0);
  });

  it("task entirely outside the week is not returned", () => {
    const outside = task({ id: "out", startTime: iso(2026, 6, 1, 9), deadline: iso(2026, 6, 5, 17) });
    expect(spanningTasksForWeek([outside], SUN_JUL12)).toHaveLength(0);
  });
});

describe("spanningTasksForWeek – lane packing", () => {
  // taskA: col 0..2 (Sun Jul12 → Tue Jul14)
  const taskA = task({ id: "A", startTime: iso(2026, 6, 12, 0), deadline: iso(2026, 6, 14, 23) });
  // taskB: col 1..3 (Mon Jul13 → Wed Jul15) — overlaps A
  const taskB = task({ id: "B", startTime: iso(2026, 6, 13, 0), deadline: iso(2026, 6, 15, 23) });
  // taskC: col 3..5 (Wed Jul15 → Fri Jul17) — starts at 3, A ends at 2, so non-overlapping with A
  const taskC = task({ id: "C", startTime: iso(2026, 6, 15, 0), deadline: iso(2026, 6, 17, 23) });

  it("two column-overlapping bars get rows 0 and 1", () => {
    const bars = spanningTasksForWeek([taskA, taskB], SUN_JUL12);
    expect(bars).toHaveLength(2);
    const rows = bars.map((b) => b.row).sort();
    expect(rows).toEqual([0, 1]);
  });

  it("two non-overlapping bars (A ends col2, C starts col3) both get row 0", () => {
    const bars = spanningTasksForWeek([taskA, taskC], SUN_JUL12);
    expect(bars).toHaveLength(2);
    expect(bars.every((b) => b.row === 0)).toBe(true);
  });
});
