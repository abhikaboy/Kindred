import { describe, expect, it } from "vitest";
import { buildQuickCaptureTask, describeEnrichment } from "./quickCapture";
import type { ParsedRecurrence, ParsedSchedule } from "./taskSuggest";

const NOW = new Date(2026, 6, 30, 9, 0, 0); // Thursday, 30 July 2026

const schedule = (over: Partial<ParsedSchedule> = {}): ParsedSchedule => ({
    startDate: null,
    startTime: null,
    deadline: null,
    ...over,
});

const weekly: ParsedRecurrence = {
    recurring: true,
    recurFrequency: "weekly",
    recurDetails: { every: 1, daysOfWeek: [0, 0, 1, 0, 0, 0, 0], behavior: "ROLLING" },
};

const monthly: ParsedRecurrence = {
    recurring: true,
    recurFrequency: "monthly",
    recurDetails: { every: 1, daysOfWeek: [0, 0, 0, 0, 0, 0, 0], behavior: "ROLLING" },
};

describe("buildQuickCaptureTask", () => {
    it("falls back to low priority and difficulty when nothing was suggested", () => {
        const task = buildQuickCaptureTask("Buy milk", null, null, null, NOW);

        expect(task).toEqual({
            content: "Buy milk",
            priority: 1,
            value: 1,
            public: true,
            active: false,
            recurring: false,
        });
    });

    it("trims the content and applies suggested fields", () => {
        const task = buildQuickCaptureTask("  Buy milk  ", null, null, { priority: 3, value: 4 }, NOW);

        expect(task.content).toBe("Buy milk");
        expect(task.priority).toBe(3);
        expect(task.value).toBe(4);
    });

    it("carries the parsed schedule across", () => {
        const start = new Date(2026, 6, 31, 17, 0).toISOString();
        const due = new Date(2026, 6, 31, 18, 0).toISOString();

        const task = buildQuickCaptureTask("Call mom", schedule({ startDate: start, startTime: start, deadline: due }), null, null, NOW);

        expect(task.startDate).toBe(start);
        expect(task.startTime).toBe(start);
        expect(task.deadline).toBe(due);
    });

    it("marks a parsed recurrence as recurring", () => {
        const task = buildQuickCaptureTask("Standup every tuesday", null, weekly, null, NOW);

        expect(task.recurring).toBe(true);
        expect(task.recurFrequency).toBe("weekly");
        expect(task.recurDetails).toEqual(weekly.recurDetails);
    });

    it("anchors a monthly recurrence on today, since the backend requires daysOfMonth", () => {
        const task = buildQuickCaptureTask("Pay rent monthly", null, monthly, null, NOW);

        expect(task.recurDetails?.daysOfMonth).toEqual([30]);
    });

    it("leaves an explicit daysOfMonth alone", () => {
        const withDays: ParsedRecurrence = {
            ...monthly,
            recurDetails: { ...monthly.recurDetails, daysOfMonth: [1] },
        };

        const task = buildQuickCaptureTask("Pay rent on the 1st", null, withDays, null, NOW);

        expect(task.recurDetails?.daysOfMonth).toEqual([1]);
    });
});

describe("describeEnrichment", () => {
    it("lists the schedule, the priority and the pending category", () => {
        expect(describeEnrichment("Fri · 5:00 PM", 3)).toBe("Fri · 5:00 PM · High priority · sorting into a category");
    });

    it("omits the parts that weren't inferred", () => {
        expect(describeEnrichment("")).toBe("sorting into a category");
    });
});
