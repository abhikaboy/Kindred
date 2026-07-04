import { clampWindowToDay } from "@/utils/taskCountsByDay";

describe("clampWindowToDay", () => {
    const jul3 = new Date(2026, 6, 3);
    const jul4 = new Date(2026, 6, 4);

    const start = new Date(2026, 6, 3, 21, 0); // 9 PM Jul 3
    const end = new Date(2026, 6, 4, 2, 0); // 2 AM Jul 4

    it("clamps a cross-midnight task to the start day (9 PM → midnight)", () => {
        const w = clampWindowToDay(start, end, jul3)!;
        expect(w.start.getTime()).toBe(start.getTime());
        expect(w.end.getTime()).toBe(new Date(2026, 6, 4, 0, 0).getTime());
    });

    it("clamps a cross-midnight task to the end day (midnight → 2 AM)", () => {
        const w = clampWindowToDay(start, end, jul4)!;
        expect(w.start.getTime()).toBe(new Date(2026, 6, 4, 0, 0).getTime());
        expect(w.end.getTime()).toBe(end.getTime());
    });

    it("returns the window untouched when it fits inside the day", () => {
        const s = new Date(2026, 6, 3, 9, 0);
        const e = new Date(2026, 6, 3, 10, 30);
        const w = clampWindowToDay(s, e, jul3)!;
        expect(w.start.getTime()).toBe(s.getTime());
        expect(w.end.getTime()).toBe(e.getTime());
    });

    it("returns null when the window doesn't touch the day", () => {
        expect(clampWindowToDay(start, end, new Date(2026, 6, 10))).toBeNull();
    });
});
