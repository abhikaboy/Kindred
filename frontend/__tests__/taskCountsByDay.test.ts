import { countTasksByDay, dayKey, fromDayKey } from "@/utils/taskCountsByDay";

const d = (s: string) => new Date(s);

describe("dayKey/fromDayKey", () => {
    it("round-trips a local date", () => {
        const date = new Date(2026, 6, 4, 15, 30);
        expect(dayKey(date)).toBe("2026-07-04");
        expect(fromDayKey("2026-07-04").getTime()).toBe(new Date(2026, 6, 4).getTime());
    });
});

describe("countTasksByDay", () => {
    const start = new Date(2026, 6, 1);
    const end = new Date(2026, 6, 31);

    it("buckets deadline and startDate days, deduping same task on one day", () => {
        const tasks = [
            { id: "a", categoryID: "c1", categoryName: "School", deadline: d("2026-07-04T14:00:00").toISOString() },
            { id: "b", categoryID: "c2", categoryName: "Gym", startDate: d("2026-07-04T08:00:00").toISOString() },
            { id: "c", categoryID: "c1", categoryName: "School",
              startDate: d("2026-07-05T09:00:00").toISOString(), deadline: d("2026-07-05T17:00:00").toISOString() },
        ];
        const counts = countTasksByDay(tasks, start, end);
        expect(counts["2026-07-04"].count).toBe(2);
        expect(counts["2026-07-05"].count).toBe(1);
        expect(counts["2026-07-06"]).toBeUndefined();
    });

    it("ignores days outside the range and tasks with no dates", () => {
        const tasks = [
            { id: "a", deadline: d("2026-08-01T00:00:00").toISOString() },
            { id: "b" },
        ];
        expect(countTasksByDay(tasks, start, end)).toEqual({});
    });

    it("collects up to 3 unique category refs", () => {
        const tasks = [1, 2, 3, 4, 5].map((n) => ({
            id: String(n), categoryID: `c${n}`, categoryName: `Cat${n}`,
            deadline: d("2026-07-10T12:00:00").toISOString(),
        }));
        const day = countTasksByDay(tasks, start, end)["2026-07-10"];
        expect(day.count).toBe(5);
        expect(day.categoryRefs).toHaveLength(3);
    });
});
