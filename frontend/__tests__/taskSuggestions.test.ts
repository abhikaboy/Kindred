import { noAppliedSchedule, scheduleUpdates, type AppliedSchedule } from "@/hooks/scheduleUpdates";
import { parseRecurrence, parseSchedule, type ParsedRecurrence, type ParsedSchedule } from "@shared/taskSuggest";

const SCHEDULE: ParsedSchedule = {
    startDate: "2026-07-31T07:00:00.000Z",
    startTime: "2026-07-31T07:00:00.000Z",
    deadline: "2026-07-31T08:00:00.000Z",
};
const WEEKDAYS: ParsedRecurrence = {
    recurring: true,
    recurFrequency: "weekly",
    recurDetails: { every: 1, daysOfWeek: [0, 1, 1, 1, 1, 1, 0], behavior: "ROLLING" },
};
const EMPTY = { startDate: null, startTime: null, deadline: null, recurring: false, flexDetails: null };

const upd = (current: typeof EMPTY, s: ParsedSchedule | null, r: ParsedRecurrence | null) =>
    scheduleUpdates(current, s, r, noAppliedSchedule()).update;

describe("scheduleUpdates", () => {
    it("offers start, deadline and recurrence when everything is at its default", () => {
        const update = upd(EMPTY, SCHEDULE, WEEKDAYS);
        expect(update.startDate?.toISOString()).toBe(SCHEDULE.startDate);
        expect(update.startTime?.toISOString()).toBe(SCHEDULE.startTime);
        expect(update.deadline?.toISOString()).toBe(SCHEDULE.deadline);
        expect(update.recurrence).toEqual(WEEKDAYS);
    });

    it("leaves a hand-set start alone but still offers the empty deadline", () => {
        const mine = { ...EMPTY, startDate: new Date(2026, 0, 1), startTime: new Date(2026, 0, 1) };
        const update = upd(mine, SCHEDULE, null);
        expect(update.startDate).toBeUndefined();
        expect(update.startTime).toBeUndefined();
        expect(update.deadline?.toISOString()).toBe(SCHEDULE.deadline);
    });

    it("leaves a hand-set deadline alone", () => {
        const mine = { ...EMPTY, deadline: new Date(2026, 0, 1) };
        expect(upd(mine, SCHEDULE, null).deadline).toBeUndefined();
    });

    it("does not touch recurrence the user already configured", () => {
        expect(upd({ ...EMPTY, recurring: true }, null, WEEKDAYS).recurrence).toBeUndefined();
    });

    it("treats flex as configured recurrence and leaves it alone", () => {
        const mine = { ...EMPTY, flexDetails: { target: 3, period: "weekly" } };
        expect(upd(mine, null, WEEKDAYS).recurrence).toBeUndefined();
    });

    it("is empty when there is nothing to apply", () => {
        expect(upd(EMPTY, null, null)).toEqual({});
        const set = { ...EMPTY, startDate: new Date(), startTime: new Date(), deadline: new Date() };
        expect(upd(set, SCHEDULE, null)).toEqual({});
    });
});

// Typing streams partial parses, so the final state must match the final parse
// rather than whichever partial landed first.
describe("scheduleUpdates over a stream of keystrokes", () => {
    const typeOut = (full: string, now: Date) => {
        const state = { ...EMPTY } as typeof EMPTY & { startDate: Date | null; deadline: Date | null };
        let applied: AppliedSchedule = noAppliedSchedule();
        for (let i = 1; i <= full.length; i++) {
            const prefix = full.slice(0, i);
            const result = scheduleUpdates(state, parseSchedule(prefix, now), parseRecurrence(prefix, now), applied);
            if (result.update.startDate) state.startDate = result.update.startDate;
            if (result.update.startTime) state.startTime = result.update.startTime;
            if (result.update.deadline) state.deadline = result.update.deadline;
            if (result.update.recurrence) state.recurring = true;
            applied = result.applied;
        }
        return state;
    };

    it("ends on the full phrase's parse, not an earlier partial one", () => {
        const now = new Date(2026, 6, 31, 9, 0, 0);
        const state = typeOut("gym tomorrow 7-8am every weekday", now);
        const final = parseSchedule("gym tomorrow 7-8am every weekday", now)!;
        expect(state.startDate?.toISOString()).toBe(final.startDate);
        expect(state.deadline?.toISOString()).toBe(final.deadline);
    });

    it("lands the refined minutes of a range typed left to right", () => {
        const state = typeOut("review notes 3pm-4:30pm friday", new Date(2026, 6, 31, 9, 0, 0));
        expect(state.deadline?.getMinutes()).toBe(30);
    });

    it("still refuses to overwrite a date the user set by hand", () => {
        const now = new Date(2026, 6, 31, 9, 0, 0);
        const mine = new Date(2026, 0, 1);
        const state = { ...EMPTY, startDate: mine, startTime: mine } as typeof EMPTY & { startDate: Date | null };
        let applied: AppliedSchedule = noAppliedSchedule();
        for (const prefix of ["gym tomorrow", "gym tomorrow 7-8am"]) {
            const result = scheduleUpdates(state, parseSchedule(prefix, now), parseRecurrence(prefix, now), applied);
            if (result.update.startDate) state.startDate = result.update.startDate;
            applied = result.applied;
        }
        expect(state.startDate).toBe(mine);
    });
});
