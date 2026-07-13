import { formatOrdinalDate, reminderRelativeLabel } from "@/utils/timeUtils";

describe("formatOrdinalDate", () => {
    it("adds correct ordinal suffixes", () => {
        expect(formatOrdinalDate(new Date(2026, 6, 1))).toBe("July 1st");
        expect(formatOrdinalDate(new Date(2026, 6, 2))).toBe("July 2nd");
        expect(formatOrdinalDate(new Date(2026, 6, 3))).toBe("July 3rd");
        expect(formatOrdinalDate(new Date(2026, 6, 6))).toBe("July 6th");
        expect(formatOrdinalDate(new Date(2026, 6, 11))).toBe("July 11th");
        expect(formatOrdinalDate(new Date(2026, 6, 22))).toBe("July 22nd");
    });
});

describe("reminderRelativeLabel", () => {
    const start = new Date(2026, 6, 5, 23, 59).toISOString();

    it("computes 'before start' shorthand", () => {
        const r = { triggerTime: new Date(2026, 6, 5, 23, 44).toISOString(), beforeStart: true };
        expect(reminderRelativeLabel(r, { start })).toBe("15 min before start");
    });

    it("collapses whole hours", () => {
        const r = { triggerTime: new Date(2026, 6, 6, 2, 59).toISOString(), afterStart: true };
        expect(reminderRelativeLabel(r, { start })).toBe("3 hr after start");
    });

    it("returns 'at start' when on the anchor", () => {
        const r = { triggerTime: start, beforeStart: true };
        expect(reminderRelativeLabel(r, { start })).toBe("at start");
    });

    it("returns null for absolute reminders or missing anchor", () => {
        expect(reminderRelativeLabel({ triggerTime: start }, { start })).toBeNull();
        expect(reminderRelativeLabel({ triggerTime: start, beforeStart: true }, {})).toBeNull();
    });
});
