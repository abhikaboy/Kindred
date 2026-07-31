import { formatMinutesToTime, minutesToDate } from "@/utils/timeUtils";

describe("formatMinutesToTime", () => {
    test("midnight and noon read as 12", () => {
        expect(formatMinutesToTime(0)).toBe("12:00 AM");
        expect(formatMinutesToTime(720)).toBe("12:00 PM");
    });

    test("pads single-digit minutes", () => {
        expect(formatMinutesToTime(545)).toBe("9:05 AM");
    });

    test("afternoon and end of day", () => {
        expect(formatMinutesToTime(810)).toBe("1:30 PM");
        expect(formatMinutesToTime(1439)).toBe("11:59 PM");
    });
});

describe("minutesToDate", () => {
    test("sets hours and minutes, zeroes seconds and ms", () => {
        const base = new Date(2026, 6, 30, 3, 7, 42, 500);
        const result = minutesToDate(base, 630);

        expect(result.getFullYear()).toBe(2026);
        expect(result.getMonth()).toBe(6);
        expect(result.getDate()).toBe(30);
        expect(result.getHours()).toBe(10);
        expect(result.getMinutes()).toBe(30);
        expect(result.getSeconds()).toBe(0);
        expect(result.getMilliseconds()).toBe(0);
    });

    test("does not mutate the base date", () => {
        const base = new Date(2026, 6, 30, 3, 7, 42, 500);
        const before = base.getTime();
        minutesToDate(base, 0);
        expect(base.getTime()).toBe(before);
    });
});
