import { describe, expect, it } from "vitest";
import { buildCreateTaskParams, emptyTaskForm } from "./useCreateActions";

describe("buildCreateTaskParams", () => {
  it("sets required fields and trims content", () => {
    const body = buildCreateTaskParams({ ...emptyTaskForm(), content: "  buy milk  ", priority: 2, value: 3, isPublic: true });
    expect(body).toMatchObject({ content: "buy milk", priority: 2, value: 3, public: true, recurring: false, active: false });
  });

  it("omits recur fields when not recurring", () => {
    const body = buildCreateTaskParams({ ...emptyTaskForm(), content: "x" });
    expect(body.recurFrequency).toBeUndefined();
    expect(body.recurDetails).toBeUndefined();
  });

  it("sets weekly recurrence details", () => {
    const body = buildCreateTaskParams({
      ...emptyTaskForm(),
      content: "x",
      recurring: true,
      recurFrequency: "weekly",
      every: 2,
      daysOfWeek: [0, 1, 0, 1, 0, 0, 0],
    });
    expect(body.recurring).toBe(true);
    expect(body.recurFrequency).toBe("weekly");
    expect(body.recurDetails).toMatchObject({ every: 2, daysOfWeek: [0, 1, 0, 1, 0, 0, 0], behavior: "ROLLING" });
  });

  it("flex mode implies recurring and sets flex + frequency from period", () => {
    const body = buildCreateTaskParams({
      ...emptyTaskForm(),
      content: "x",
      flex: { target: 3, period: "weekly" },
    });
    expect(body.recurring).toBe(true);
    expect(body.recurFrequency).toBe("weekly");
    expect(body.recurDetails?.flex).toEqual({ target: 3, period: "weekly" });
  });

  it("omits empty optionals but includes populated ones", () => {
    const empty = buildCreateTaskParams({ ...emptyTaskForm(), content: "x" });
    expect(empty.notes).toBeUndefined();
    expect(empty.integration).toBeUndefined();
    expect(empty.taggedUserIds).toBeUndefined();
    expect(empty.reminders).toBeUndefined();

    const full = buildCreateTaskParams({
      ...emptyTaskForm(),
      content: "x",
      notes: "n",
      integration: "slack",
      deadline: "2026-07-20T10:00:00.000Z",
      taggedUserIds: ["a", "b"],
      reminders: [{ triggerTime: "2026-07-19T09:00:00.000Z" }],
    });
    expect(full.notes).toBe("n");
    expect(full.integration).toBe("slack");
    expect(full.deadline).toBe("2026-07-20T10:00:00.000Z");
    expect(full.taggedUserIds).toEqual(["a", "b"]);
    expect(full.reminders?.[0]).toMatchObject({ triggerTime: "2026-07-19T09:00:00.000Z", type: "absolute", sent: false });
  });
});
