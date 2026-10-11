import {
    HIDE_MS,
    hideTask,
    hoursLeft,
    isHidden,
    nextReturnAt,
    parseHiddenMap,
    pruneExpired,
    showTask,
} from "@/utils/stageHidden";
import { assignDate } from "@/utils/somedayAssign";

const NOW = new Date("2026-10-12T10:00:00").getTime(); // a Monday

describe("hiding a task", () => {
    test("hides for exactly 8 hours", () => {
        const map = hideTask({}, "a", NOW);
        expect(new Date(map.a).getTime()).toBe(NOW + HIDE_MS);
        expect(isHidden(map, "a", NOW + HIDE_MS - 1)).toBe(true);
        expect(isHidden(map, "a", NOW + HIDE_MS)).toBe(false);
    });

    test("showing removes only that task", () => {
        const map = hideTask(hideTask({}, "a", NOW), "b", NOW);
        expect(Object.keys(showTask(map, "a"))).toEqual(["b"]);
    });

    test("hiding prunes anything already back", () => {
        const old = { gone: new Date(NOW - 1000).toISOString() };
        expect(Object.keys(hideTask(old, "a", NOW))).toEqual(["a"]);
    });
});

describe("expiry", () => {
    test("pruneExpired keeps only future entries and drops unreadable ones", () => {
        const map = { keep: new Date(NOW + 5000).toISOString(), gone: new Date(NOW - 5000).toISOString(), bad: "nope" };
        expect(Object.keys(pruneExpired(map, NOW))).toEqual(["keep"]);
    });

    test("hoursLeft rounds up and never says 0", () => {
        expect(hoursLeft(new Date(NOW + HIDE_MS).toISOString(), NOW)).toBe(8);
        expect(hoursLeft(new Date(NOW + 61 * 60000).toISOString(), NOW)).toBe(2);
        expect(hoursLeft(new Date(NOW + 1000).toISOString(), NOW)).toBe(1);
    });

    test("nextReturnAt is the soonest return, or null when nothing is hidden", () => {
        const map = { a: new Date(NOW + 3 * 3600000).toISOString(), b: new Date(NOW + 1 * 3600000).toISOString() };
        expect(nextReturnAt(map, NOW)).toBe(NOW + 3600000);
        expect(nextReturnAt({}, NOW)).toBeNull();
    });
});

describe("stored state", () => {
    test("reads valid state and ignores garbage", () => {
        const raw = JSON.stringify({ a: new Date(NOW + 1000).toISOString(), b: 5 });
        expect(Object.keys(parseHiddenMap(raw, NOW))).toEqual(["a"]);
        expect(parseHiddenMap(null, NOW)).toEqual({});
        expect(parseHiddenMap("{not json", NOW)).toEqual({});
        expect(parseHiddenMap("[1,2]", NOW)).toEqual({});
    });
});

describe("assignDate", () => {
    const monday = new Date("2026-10-12T10:00:00");
    test("next week is the following Monday at 9 AM", () => {
        const d = assignDate("nextWeek", monday);
        expect(d.getDay()).toBe(1);
        expect(d.getHours()).toBe(9);
        expect(d.getTime() - monday.getTime()).toBeGreaterThan(6 * 86400000);
    });
    test("tomorrow is the next day at 9 AM", () => {
        const d = assignDate("tomorrow", monday);
        expect(d.getDate()).toBe(13);
        expect(d.getHours()).toBe(9);
    });
});
