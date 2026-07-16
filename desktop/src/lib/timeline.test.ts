import { describe, it, expect } from "vitest";
import { minutesToY, yToMinutes, HOUR_HEIGHT, layoutTimedTask, layoutDayEvents } from "./timeline";
import type { TaskDocument } from "@/hooks/useWorkspaces";

describe("timeline math", () => {
  it("maps minutes to y at HOUR_HEIGHT per 60 min", () => {
    expect(minutesToY(60)).toBe(HOUR_HEIGHT);
    expect(minutesToY(90)).toBe(HOUR_HEIGHT * 1.5);
  });
  it("inverts y to minutes snapped to 15 and clamped", () => {
    expect(yToMinutes(minutesToY(65))).toBe(60); // 65 -> snaps to 60
    expect(yToMinutes(-100)).toBe(0);
    expect(yToMinutes(minutesToY(2000))).toBe(1439);
  });
});

describe("layoutTimedTask", () => {
  const day = new Date(2026, 6, 15);
  it("positions by startTime and sizes by deadline", () => {
    const t = {
      startTime: new Date(2026, 6, 15, 9).toISOString(),
      deadline: new Date(2026, 6, 15, 10, 30).toISOString(),
    } as TaskDocument;
    const { top, height } = layoutTimedTask(t, day);
    expect(top).toBe(minutesToY(540));
    expect(height).toBe(minutesToY(90));
  });
  it("defaults to 60 min when no deadline", () => {
    const t = { startTime: new Date(2026, 6, 15, 9).toISOString() } as TaskDocument;
    expect(layoutTimedTask(t, day).height).toBe(minutesToY(60));
  });
});

describe("layoutDayEvents", () => {
  const day = new Date(2026, 6, 15);
  const ev = (id: string, sh: number, eh: number): TaskDocument =>
    ({ id, startTime: new Date(2026, 6, 15, sh).toISOString(), deadline: new Date(2026, 6, 15, eh).toISOString() } as TaskDocument);
  const byId = (r: ReturnType<typeof layoutDayEvents>) => Object.fromEntries(r.map((p) => [p.task.id, p]));

  it("gives a lone event full width", () => {
    const [p] = layoutDayEvents([ev("a", 9, 10)], day);
    expect(p.leftPct).toBe(0);
    expect(p.widthPct).toBe(1);
  });

  it("splits two overlapping events into half-width lanes", () => {
    const m = byId(layoutDayEvents([ev("a", 9, 11), ev("b", 10, 12)], day));
    expect(m.a.widthPct).toBe(0.5);
    expect(m.b.widthPct).toBe(0.5);
    expect(new Set([m.a.leftPct, m.b.leftPct])).toEqual(new Set([0, 0.5]));
  });

  it("reuses a lane for non-overlapping events (both stay full width)", () => {
    const r = layoutDayEvents([ev("a", 9, 10), ev("b", 11, 12)], day);
    expect(r.every((p) => p.widthPct === 1 && p.leftPct === 0)).toBe(true);
  });

  it("keeps a chained cluster at the cluster's lane count", () => {
    // a[9-10] & c[9.5-11] overlap; b[10.5-12] overlaps c only — one 2-lane cluster.
    const m = byId(layoutDayEvents([ev("a", 9, 10), ev("c", 9, 11), ev("b", 10, 12)], day));
    expect(m.a.widthPct).toBe(0.5);
    expect(m.b.widthPct).toBe(0.5);
    expect(m.c.widthPct).toBe(0.5);
  });
});
