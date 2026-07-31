import { scheduleUpdates } from "@/hooks/scheduleUpdates";
import type { ParsedRecurrence, ParsedSchedule } from "@shared/taskSuggest";

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

describe("scheduleUpdates", () => {
    it("offers start, deadline and recurrence when everything is at its default", () => {
        const update = scheduleUpdates(EMPTY, SCHEDULE, WEEKDAYS);
        expect(update.startDate?.toISOString()).toBe(SCHEDULE.startDate);
        expect(update.startTime?.toISOString()).toBe(SCHEDULE.startTime);
        expect(update.deadline?.toISOString()).toBe(SCHEDULE.deadline);
        expect(update.recurrence).toEqual(WEEKDAYS);
    });

    it("leaves a hand-set start alone but still offers the empty deadline", () => {
        const mine = { ...EMPTY, startDate: new Date(2026, 0, 1), startTime: new Date(2026, 0, 1) };
        const update = scheduleUpdates(mine, SCHEDULE, null);
        expect(update.startDate).toBeUndefined();
        expect(update.startTime).toBeUndefined();
        expect(update.deadline?.toISOString()).toBe(SCHEDULE.deadline);
    });

    it("leaves a hand-set deadline alone", () => {
        const mine = { ...EMPTY, deadline: new Date(2026, 0, 1) };
        expect(scheduleUpdates(mine, SCHEDULE, null).deadline).toBeUndefined();
    });

    it("does not touch recurrence the user already configured", () => {
        expect(scheduleUpdates({ ...EMPTY, recurring: true }, null, WEEKDAYS).recurrence).toBeUndefined();
    });

    it("treats flex as configured recurrence and leaves it alone", () => {
        const mine = { ...EMPTY, flexDetails: { target: 3, period: "weekly" } };
        expect(scheduleUpdates(mine, null, WEEKDAYS).recurrence).toBeUndefined();
    });

    it("is empty when there is nothing to apply", () => {
        expect(scheduleUpdates(EMPTY, null, null)).toEqual({});
        const set = { ...EMPTY, startDate: new Date(), startTime: new Date(), deadline: new Date() };
        expect(scheduleUpdates(set, SCHEDULE, null)).toEqual({});
    });
});
