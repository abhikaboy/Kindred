import { projectRecurringTasks } from "@/utils/recurrenceProjection";

const base = { id: "t1", templateID: "tpl", recurring: true, recurDetails: { every: 1 } };

describe("projectRecurringTasks", () => {
    it("projects a daily task onto every later day in range, keeping time of day", () => {
        const task = { ...base, recurFrequency: "daily", recurType: "OCCURRENCE", startDate: new Date(2026, 8, 28, 9).toISOString() };
        const out = projectRecurringTasks([task], new Date(2026, 8, 28), new Date(2026, 9, 1));
        expect(out.map((t) => new Date(t.startDate).getDate())).toEqual([29, 30, 1]);
        expect(new Date(out[0].startDate).getHours()).toBe(9);
        expect(out[0]).toMatchObject({ projected: true, sourceId: "t1" });
    });

    it("follows weekly days of week", () => {
        // Mon + Thu (Sun=0)
        const task = { ...base, recurFrequency: "weekly", recurType: "DEADLINE", recurDetails: { every: 1, daysOfWeek: [0, 1, 0, 0, 1, 0, 0] }, deadline: new Date(2026, 8, 28).toISOString() };
        const out = projectRecurringTasks([task], new Date(2026, 8, 28), new Date(2026, 9, 6));
        expect(out.map((t) => new Date(t.deadline).getDate())).toEqual([1, 5]);
    });

    it("skips days a real instance already covers and ignores FLEX", () => {
        const a = { ...base, recurFrequency: "daily", startDate: new Date(2026, 8, 28).toISOString() };
        const b = { ...a, id: "t2", startDate: new Date(2026, 8, 29).toISOString() };
        const flex = { ...a, id: "f", templateID: "x", recurType: "FLEX" };
        const out = projectRecurringTasks([a, b, flex], new Date(2026, 8, 28), new Date(2026, 8, 30));
        expect(out.map((t) => t.sourceId + new Date(t.startDate).getDate())).toEqual(["t230"]);
    });

    it("clamps monthly days to short months", () => {
        const task = { ...base, recurFrequency: "monthly", recurDetails: { every: 1, daysOfMonth: [31] }, startDate: new Date(2026, 0, 31).toISOString() };
        const out = projectRecurringTasks([task], new Date(2026, 1, 1), new Date(2026, 1, 28));
        expect(new Date(out[0].startDate).getDate()).toBe(28);
    });
});
