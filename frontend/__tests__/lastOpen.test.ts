jest.mock("@react-native-async-storage/async-storage", () => {
    const store: Record<string, string> = {};
    return {
        getItem: jest.fn(async (k: string) => store[k] ?? null),
        setItem: jest.fn(async (k: string, v: string) => {
            store[k] = v;
        }),
    };
});

import { gapDays, getPendingGap, markGapHandled, pendingGap, recordAppOpen } from "@/utils/lastOpen";

const DAY = 86400_000;

describe("gap maths", () => {
    it("counts whole days and ignores missing or future opens", () => {
        expect(gapDays(0, 5 * DAY)).toBe(0);
        expect(gapDays(null, 5 * DAY)).toBe(0);
        expect(gapDays(1, 4 * DAY + 2)).toBe(4);
        expect(gapDays(10 * DAY, DAY)).toBe(0);
    });
    it("skips gaps under the minimum or already handled", () => {
        expect(pendingGap(1000, 1000 + 3 * DAY, null, 4)).toBeNull();
        expect(pendingGap(1000, 1000 + 4 * DAY, null, 4)).toEqual({ key: "1000", days: 4 });
        expect(pendingGap(1000, 1000 + 4 * DAY, "1000", 4)).toBeNull();
    });
});

describe("recordAppOpen", () => {
    it("offers a gap once, and a quick reopen keeps it until handled", async () => {
        const t0 = 1_000_000_000_000;
        await recordAppOpen(t0);
        expect(getPendingGap()).toBeNull();
        await recordAppOpen(t0 + 5 * DAY);
        expect(getPendingGap()).toEqual({ key: String(t0), days: 5 });
        await recordAppOpen(t0 + 5 * DAY + 60_000);
        expect(getPendingGap()?.days).toBe(5);
        markGapHandled();
        expect(getPendingGap()).toBeNull();
    });
});
