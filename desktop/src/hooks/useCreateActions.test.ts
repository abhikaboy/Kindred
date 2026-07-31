import { describe, expect, it } from "vitest";
import { parseRecurrence, parseSchedule, type ParsedRecurrence } from "@shared/taskSuggest";
import {
  applySchedule,
  buildCreateTaskParams,
  clearSchedule,
  emptyTaskForm,
  noAppliedSuggestion,
  type TaskFormState,
} from "./useCreateActions";
import { countPreviewTasks, buildConfirmBody, type AiPreviewPayload } from "./useCreateActions";

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

  // ValidateRecurDetails rejects monthly with an empty daysOfMonth; no UI sets it,
  // and both the Repeat popover and a typed "every 6 months" reach this path.
  it("always sends daysOfMonth for monthly so the backend accepts it", () => {
    const body = buildCreateTaskParams({
      ...emptyTaskForm(),
      content: "x",
      recurring: true,
      recurFrequency: "monthly",
      every: 6,
    });
    expect(body.recurDetails?.daysOfMonth).toEqual([new Date().getDate()]);
  });

  it("omits daysOfMonth for non-monthly frequencies", () => {
    const body = buildCreateTaskParams({ ...emptyTaskForm(), content: "x", recurring: true, recurFrequency: "weekly" });
    expect(body.recurDetails?.daysOfMonth).toBeUndefined();
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

const SCHEDULE = {
  startDate: "2026-07-31T07:00:00.000Z",
  startTime: "2026-07-31T07:00:00.000Z",
  deadline: "2026-07-31T08:00:00.000Z",
};
const WEEKDAYS: ParsedRecurrence = {
  recurring: true,
  recurFrequency: "weekly",
  recurDetails: { every: 1, daysOfWeek: [0, 1, 1, 1, 1, 1, 0], behavior: "ROLLING" },
};

const apply = (form: ReturnType<typeof emptyTaskForm>, s: typeof SCHEDULE | null, r: ParsedRecurrence | null) =>
  applySchedule(form, s, r, noAppliedSuggestion()).form;

describe("applySchedule", () => {
  it("fills start, deadline and recurrence when all are at their defaults", () => {
    const next = apply(emptyTaskForm(), SCHEDULE, WEEKDAYS);
    expect(next).toMatchObject({
      startDate: SCHEDULE.startDate,
      startTime: SCHEDULE.startTime,
      deadline: SCHEDULE.deadline,
      recurring: true,
      recurFrequency: "weekly",
      every: 1,
      daysOfWeek: [0, 1, 1, 1, 1, 1, 0],
    });
  });

  it("leaves a hand-set start untouched but still fills the empty deadline", () => {
    const mine = { ...emptyTaskForm(), startDate: "2026-01-01T00:00:00.000Z", startTime: "2026-01-01T00:00:00.000Z" };
    const next = apply(mine, SCHEDULE, null);
    expect(next.startDate).toBe("2026-01-01T00:00:00.000Z");
    expect(next.startTime).toBe("2026-01-01T00:00:00.000Z");
    expect(next.deadline).toBe(SCHEDULE.deadline);
  });

  it("leaves a hand-set deadline untouched", () => {
    const mine = { ...emptyTaskForm(), deadline: "2026-01-01T00:00:00.000Z" };
    expect(apply(mine, SCHEDULE, null).deadline).toBe("2026-01-01T00:00:00.000Z");
  });

  it("does not touch recurrence the user already configured", () => {
    const mine = { ...emptyTaskForm(), recurring: true, recurFrequency: "daily", every: 3 };
    const next = apply(mine, null, WEEKDAYS);
    expect(next.recurFrequency).toBe("daily");
    expect(next.every).toBe(3);
  });

  it("treats flex as configured recurrence and leaves it alone", () => {
    const mine = { ...emptyTaskForm(), flex: { target: 3, period: "weekly" } };
    expect(apply(mine, null, WEEKDAYS).recurring).toBe(false);
  });

  it("returns the same object when nothing applies, so effects do not loop", () => {
    const form = emptyTaskForm();
    expect(apply(form, null, null)).toBe(form);
    const set = { ...form, startDate: "x", startTime: "x", deadline: "y" };
    expect(apply(set, SCHEDULE, null)).toBe(set);
  });
});

// Typing arrives one character at a time, so the form sees a stream of partial
// parses. The final form must match the final parse, not whichever partial
// landed first.
describe("applySchedule over a stream of keystrokes", () => {
  const typeOut = (full: string, now: Date) => {
    let form = emptyTaskForm();
    let applied = noAppliedSuggestion();
    for (let i = 1; i <= full.length; i++) {
      const prefix = full.slice(0, i);
      const result = applySchedule(form, parseSchedule(prefix, now), parseRecurrence(prefix, now), applied);
      form = result.form;
      applied = result.applied;
    }
    return form;
  };

  it("ends on the full phrase's parse, not an earlier partial one", () => {
    const now = new Date(2026, 6, 31, 9, 0, 0);
    const form = typeOut("gym tomorrow 7-8am every weekday", now);
    const final = parseSchedule("gym tomorrow 7-8am every weekday", now)!;
    expect(form.startDate).toBe(final.startDate);
    expect(form.deadline).toBe(final.deadline);
  });

  it("lands the refined minutes of a range typed left to right", () => {
    const now = new Date(2026, 6, 31, 9, 0, 0);
    const form = typeOut("review notes 3pm-4:30pm friday", now);
    expect(new Date(form.deadline!).getMinutes()).toBe(30);
  });

  it("still refuses to overwrite a date the user set by hand", () => {
    const now = new Date(2026, 6, 31, 9, 0, 0);
    const mine = "2026-01-01T00:00:00.000Z";
    let form: TaskFormState = { ...emptyTaskForm(), startDate: mine, startTime: mine };
    let applied = noAppliedSuggestion();
    for (const prefix of ["gym tomorrow", "gym tomorrow 7-8am"]) {
      const result = applySchedule(form, parseSchedule(prefix, now), parseRecurrence(prefix, now), applied);
      form = result.form;
      applied = result.applied;
    }
    expect(form.startDate).toBe(mine);
  });
});

describe("clearSchedule", () => {
  it("resets the schedule fields but keeps everything else", () => {
    const filled = { ...apply(emptyTaskForm(), SCHEDULE, WEEKDAYS), content: "gym", priority: 3, value: 4 };
    const next = clearSchedule(filled);
    expect(next).toMatchObject({ startDate: null, startTime: null, deadline: null, recurring: false, every: 1 });
    expect(next).toMatchObject({ content: "gym", priority: 3, value: 4 });
  });
});

const samplePayload = (): AiPreviewPayload => ({
  categories: [
    { name: "Fitness", workspaceName: "Personal", tasks: [
      { content: "Gym at 7am", priority: 2, public: true, recurring: false, value: 1 },
      { content: "Protein shake", priority: 1, public: true, recurring: false, value: 1 },
    ] },
    { name: "Empty", workspaceName: "Personal", tasks: [] },
  ],
  tasks: [
    { categoryId: "abc", categoryName: "Work", task: { content: "Ship PR", priority: 3, public: true, recurring: false, value: 1 } },
  ],
});

describe("countPreviewTasks", () => {
  it("sums new-category tasks and existing-category pairs", () => {
    expect(countPreviewTasks(samplePayload())).toBe(3);
  });
  it("is zero for an empty payload", () => {
    expect(countPreviewTasks({ categories: [], tasks: [] })).toBe(0);
  });
});

describe("buildConfirmBody", () => {
  it("drops new categories that have no tasks left", () => {
    const body = buildConfirmBody(samplePayload());
    expect(body.categories.map((c) => c.name)).toEqual(["Fitness"]);
    expect(body.tasks).toHaveLength(1);
  });
});
