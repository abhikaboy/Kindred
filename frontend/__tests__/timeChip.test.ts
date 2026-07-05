import { abbreviateDistance, getTimeChipInfo } from "@/utils/timeChip";

const hours = (n: number) => new Date(Date.now() + n * 3600_000).toISOString();
const days = (n: number) => new Date(Date.now() + n * 86400_000).toISOString();

describe("abbreviateDistance", () => {
    it.each([
        ["3 hours", "3h"],
        ["1 hour", "1h"],
        ["45 minutes", "45m"],
        ["2 days", "2d"],
        ["3 weeks", "3w"],
        ["5 months", "5mo"],
        ["1 year", "1y"],
        ["30 seconds", "30s"],
    ])("%s -> %s", (input, expected) => {
        expect(abbreviateDistance(input)).toBe(expected);
    });
});

describe("getTimeChipInfo", () => {
    it("returns null without task or time fields", () => {
        expect(getTimeChipInfo(undefined, true)).toBeNull();
        expect(getTimeChipInfo({}, true)).toBeNull();
    });

    it("returns null when not detailed (except phantom)", () => {
        expect(getTimeChipInfo({ deadline: hours(3) }, false)).toBeNull();
    });

    it("future deadline -> due chip with clock", () => {
        expect(getTimeChipInfo({ deadline: hours(3) }, true)).toEqual({
            label: "due in 3h",
            tone: "neutral",
            icon: "clock",
        });
    });

    it("past deadline -> overdue tone", () => {
        expect(getTimeChipInfo({ deadline: hours(-2) }, true)).toEqual({
            label: "2h overdue",
            tone: "overdue",
            icon: "clock",
        });
    });

    it("before startTime with deadline -> starts chip", () => {
        expect(getTimeChipInfo({ startTime: days(2), deadline: days(3) }, true)).toEqual({
            label: "starts in 2d",
            tone: "neutral",
            icon: "calendar",
        });
    });

    it("after startTime with deadline -> falls through to deadline", () => {
        const info = getTimeChipInfo({ startTime: hours(-1), deadline: hours(3) }, true);
        expect(info).toEqual({ label: "due in 3h", tone: "neutral", icon: "clock" });
    });

    it("startDate only, tomorrow -> 'tomorrow'", () => {
        // +25h is safely tomorrow regardless of time of day the test runs
        const info = getTimeChipInfo({ startDate: hours(25) }, true);
        expect(info?.label).toBe("tomorrow");
        expect(info?.icon).toBe("calendar");
    });

    it("phantom with nextGenerated ignores detailed=false", () => {
        // hours(0) = right now, so "today" holds no matter when the suite runs
        const info = getTimeChipInfo({ isPhantom: true, nextGenerated: hours(0) }, false);
        expect(info?.label).toBe("today");
        expect(info?.icon).toBe("calendar");
    });

    it("bad date strings return null instead of throwing", () => {
        expect(getTimeChipInfo({ deadline: "not-a-date" }, true)).toBeNull();
    });

    it("nextGenerated 3 days out -> label is a weekday name", () => {
        const info = getTimeChipInfo({ isPhantom: true, nextGenerated: days(3) }, true);
        expect(info?.label).toMatch(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/);
        expect(info?.tone).toBe("neutral");
        expect(info?.icon).toBe("calendar");
    });

    it("nextGenerated 10 days out -> label matches Mon dd format", () => {
        const info = getTimeChipInfo({ isPhantom: true, nextGenerated: days(10) }, true);
        expect(info?.label).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
        expect(info?.tone).toBe("neutral");
        expect(info?.icon).toBe("calendar");
    });
});
