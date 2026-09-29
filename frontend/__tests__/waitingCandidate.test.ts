import { daysWaiting, fogCandidates, isPassedPlan, isSomeday, pickWaitingCandidate } from "@/utils/waitingCandidate";

const NOW = new Date(2026, 8, 28, 12);
const ago = (n: number) => new Date(NOW.getTime() - n * 86400_000).toISOString();
const ahead = (n: number) => new Date(NOW.getTime() + n * 86400_000).toISOString();

describe("pickWaitingCandidate", () => {
    it("returns null when nothing is severe", () => {
        expect(pickWaitingCandidate([{ id: "a", deadline: ago(2) }], { now: NOW })).toBeNull();
    });

    it("returns exactly one, the oldest", () => {
        const tasks = [
            { id: "a", deadline: ago(8) },
            { id: "b", deadline: ago(20) },
            { id: "c", deadline: ago(10) },
        ];
        expect(pickWaitingCandidate(tasks, { now: NOW })?.id).toBe("b");
    });

    it("breaks ties by priority", () => {
        const tasks = [
            { id: "low", deadline: ago(9), priority: 1 },
            { id: "high", deadline: ago(9), priority: 3 },
        ];
        expect(pickWaitingCandidate(tasks, { now: NOW })?.id).toBe("high");
    });

    it("treats repeated reschedules as severe", () => {
        expect(pickWaitingCandidate([{ id: "a", deadline: ago(1), rescheduleCount: 3 }], { now: NOW })?.id).toBe("a");
    });

    it("skips in plan, recently parked, released and snoozed tasks", () => {
        const tasks = [
            { id: "plan", deadline: ago(9), plan: { at: ahead(1) } },
            { id: "parked", deadline: ago(9), parkedAt: ago(2) },
            { id: "released", deadline: ago(9), releasedAt: ago(1) },
            { id: "snoozed", deadline: ago(9) },
        ];
        expect(pickWaitingCandidate(tasks, { now: NOW, snoozedIds: new Set(["snoozed"]) })).toBeNull();
    });

    it("offers a passed plan again", () => {
        const task = { id: "a", deadline: ago(9), plan: { at: ago(1) } };
        expect(isPassedPlan(task, NOW)).toBe(true);
        expect(pickWaitingCandidate([task], { now: NOW })?.id).toBe("a");
    });

    it("counts undated tasks from their start day", () => {
        expect(daysWaiting({ id: "a", startDate: ago(4) }, NOW)).toBe(4);
    });
});

describe("fogCandidates", () => {
    it("stays empty at five or fewer waiting", () => {
        const tasks = Array.from({ length: 5 }, (_, i) => ({ id: `${i}`, deadline: ago(30) }));
        expect(fogCandidates(tasks, NOW)).toEqual([]);
    });

    it("offers only tasks waiting two weeks or more, never ones in plan", () => {
        const tasks = [
            ...Array.from({ length: 4 }, (_, i) => ({ id: `old${i}`, deadline: ago(20) })),
            { id: "fresh", deadline: ago(3) },
            { id: "planned", deadline: ago(30), plan: { at: ahead(1) } },
            { id: "fresh2", deadline: ago(2) },
        ];
        expect(fogCandidates(tasks, NOW).map((t) => t.id)).toEqual(["old0", "old1", "old2", "old3"]);
    });
});

describe("someday", () => {
    it("is someday only when somedayAt is set", () => {
        expect(isSomeday({ somedayAt: ago(1) })).toBe(true);
        expect(isSomeday({ somedayAt: null })).toBe(false);
        expect(isSomeday({})).toBe(false);
    });

    it("never picks a someday task, even with an old start day or many reschedules", () => {
        const tasks = [
            { id: "someday-start", startDate: ago(40), somedayAt: ago(1) },
            { id: "someday-resched", rescheduleCount: 9, somedayAt: ago(2) },
        ];
        expect(pickWaitingCandidate(tasks, { now: NOW })).toBeNull();
        expect(pickWaitingCandidate([...tasks, { id: "waiting", deadline: ago(10) }], { now: NOW })?.id).toBe("waiting");
    });

    it("leaves someday tasks out of the fog and its threshold", () => {
        const waiting = Array.from({ length: 5 }, (_, i) => ({ id: `w${i}`, deadline: ago(20) }));
        const someday = Array.from({ length: 3 }, (_, i) => ({ id: `s${i}`, startDate: ago(30), somedayAt: ago(1) }));
        expect(fogCandidates([...waiting, ...someday], NOW)).toEqual([]);
        const more = [...waiting, { id: "w5", deadline: ago(20) }, ...someday];
        expect(fogCandidates(more, NOW).map((t) => t.id)).toEqual(["w0", "w1", "w2", "w3", "w4", "w5"]);
    });
});
