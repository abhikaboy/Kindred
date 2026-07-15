import { describe, it, expect } from "vitest";
import { minutesToY, yToMinutes, HOUR_HEIGHT, layoutTimedTask } from "./timeline";
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
