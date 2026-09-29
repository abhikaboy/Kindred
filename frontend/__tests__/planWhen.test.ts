import { planWhenDate, planWhenPhrase, planDayLabel, formatClock } from "@/utils/planWhen";

// 2026-09-28 is a Monday
const mon = (h: number, m = 0) => new Date(2026, 8, 28, h, m);

describe("planWhenDate", () => {
    it("tonight is 8 PM, or an hour out once the evening has started", () => {
        expect(planWhenDate("tonight", mon(9))).toEqual(new Date(2026, 8, 28, 20));
        expect(planWhenDate("tonight", mon(21, 10))).toEqual(new Date(2026, 8, 28, 22, 15));
    });

    it("tomorrow is 9 AM the next day", () => {
        expect(planWhenDate("tomorrow", mon(23))).toEqual(new Date(2026, 8, 29, 9));
    });

    it("this weekend is Saturday 10 AM, then Sunday, then soon", () => {
        expect(planWhenDate("weekend", mon(9))).toEqual(new Date(2026, 9, 3, 10));
        expect(planWhenDate("weekend", new Date(2026, 9, 3, 8))).toEqual(new Date(2026, 9, 3, 10));
        expect(planWhenDate("weekend", new Date(2026, 9, 3, 14))).toEqual(new Date(2026, 9, 4, 10));
        expect(planWhenDate("weekend", new Date(2026, 9, 4, 14))).toEqual(new Date(2026, 9, 4, 15));
    });

    it("picked uses the picked date", () => {
        const picked = new Date(2026, 9, 1, 19);
        expect(planWhenDate("picked", mon(9), picked)).toEqual(picked);
    });
});

describe("planWhen labels", () => {
    it("phrases each choice", () => {
        expect(planWhenPhrase("tonight", mon(20), mon(9))).toBe("tonight");
        expect(planWhenPhrase("weekend", mon(20), mon(9))).toBe("this weekend");
        expect(planWhenPhrase("picked", new Date(2026, 9, 1, 19), mon(9))).toBe("Thursday at 7 PM");
        expect(planWhenPhrase("picked", new Date(2026, 8, 29, 7, 30), mon(9))).toBe("tomorrow at 7:30 AM");
    });

    it("labels the day", () => {
        expect(planDayLabel(mon(20), mon(9))).toBe("Today");
        expect(planDayLabel(new Date(2026, 8, 29, 9), mon(9))).toBe("Tomorrow");
        expect(planDayLabel(new Date(2026, 9, 3, 10), mon(9))).toBe("Saturday");
    });

    it("formats the clock", () => {
        expect(formatClock(new Date(2026, 0, 1, 0, 5))).toBe("12:05 AM");
        expect(formatClock(new Date(2026, 0, 1, 12))).toBe("12 PM");
    });
});
