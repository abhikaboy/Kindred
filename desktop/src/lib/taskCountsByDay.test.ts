import { describe, it, expect } from "vitest";
import { dayKey, fromDayKey, clampWindowToDay, countTasksByDay } from "./taskCountsByDay";

describe("dayKey", () => {
  it("formats local Y-M-D zero-padded", () => {
    expect(dayKey(new Date(2026, 6, 5))).toBe("2026-07-05");
  });
  it("round-trips through fromDayKey", () => {
    const d = fromDayKey("2026-07-05");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(5);
  });
});

describe("clampWindowToDay", () => {
  const day = new Date(2026, 6, 15);
  it("returns null when the window misses the day", () => {
    expect(clampWindowToDay(new Date(2026, 6, 16), new Date(2026, 6, 17), day)).toBeNull();
  });
  it("clamps a spanning window to the day bounds", () => {
    const r = clampWindowToDay(new Date(2026, 6, 14, 22), new Date(2026, 6, 16, 2), day)!;
    expect(r.start.getTime()).toBe(new Date(2026, 6, 15).getTime());
    expect(r.end.getTime()).toBe(new Date(2026, 6, 16).getTime());
  });
});

describe("countTasksByDay", () => {
  const start = new Date(2026, 6, 1);
  const end = new Date(2026, 6, 31);
  it("counts a task on its deadline day", () => {
    const out = countTasksByDay([{ deadline: new Date(2026, 6, 15, 9).toISOString(), categoryID: "c1" }], start, end);
    expect(out["2026-07-15"].count).toBe(1);
  });
  it("ignores tasks with no startDate or deadline", () => {
    const out = countTasksByDay([{ categoryID: "c1" }], start, end);
    expect(Object.keys(out)).toHaveLength(0);
  });
  it("dedupes category refs and caps at 3", () => {
    const iso = new Date(2026, 6, 15, 9).toISOString();
    const out = countTasksByDay(
      [
        { deadline: iso, categoryID: "a" },
        { deadline: iso, categoryID: "a" },
        { deadline: iso, categoryID: "b" },
        { deadline: iso, categoryID: "c" },
        { deadline: iso, categoryID: "d" },
      ],
      start,
      end
    );
    expect(out["2026-07-15"].count).toBe(5);
    expect(out["2026-07-15"].categoryRefs).toHaveLength(3);
  });
});
