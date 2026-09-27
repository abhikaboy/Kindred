import { describe, expect, it, vi } from "vitest";
import { quickLogDoneKey, todaysOpenTasks, runEndOfDaySubmission } from "./endOfDay";

type T = { id: string; content?: string; categoryID?: string; startDate?: string; deadline?: string };
const task = (over: Partial<T>): T => ({ id: "t", content: "", categoryID: "cat-1", ...over });

describe("todaysOpenTasks", () => {
    const now = new Date(2026, 5, 10, 20, 30);

    it("includes tasks starting today, due today, and overdue", () => {
        const tasks = [
            task({ id: "starts-today", startDate: new Date(2026, 5, 10, 9).toISOString() }),
            task({ id: "due-today", deadline: new Date(2026, 5, 10, 22).toISOString() }),
            task({ id: "overdue", deadline: new Date(2026, 5, 8).toISOString() }),
            task({ id: "future", startDate: new Date(2026, 5, 12).toISOString() }),
        ];
        expect(todaysOpenTasks(tasks, now).map((t) => t.id)).toEqual(["starts-today", "due-today", "overdue"]);
    });

    it("dedupes a task that both starts and is due today", () => {
        const both = task({
            id: "both",
            startDate: new Date(2026, 5, 10, 9).toISOString(),
            deadline: new Date(2026, 5, 10, 22).toISOString(),
        });
        expect(todaysOpenTasks([both], now)).toHaveLength(1);
    });

    it("excludes synthetic upcoming categories (not real, not completable)", () => {
        const synthetic = task({
            id: "synth",
            categoryID: "upcoming-Personal",
            startDate: new Date(2026, 5, 10).toISOString(),
        });
        expect(todaysOpenTasks([synthetic], now)).toHaveLength(0);
    });
});

describe("runEndOfDaySubmission", () => {
    const checked = [task({ id: "t1", categoryID: "c1" }), task({ id: "t2", categoryID: "c2" })];

    it("bulk-completes checked tasks and logs entries with the right payloads", async () => {
        const bulkComplete = vi.fn().mockResolvedValue({ totalCompleted: 2, totalFailed: 0, failedTaskIds: [] });
        const logTasks = vi.fn().mockResolvedValue({ tasksLogged: 1, currentStreak: 3 });

        const result = await runEndOfDaySubmission(checked, ["gym"], "Personal", { bulkComplete, logTasks });

        expect(bulkComplete).toHaveBeenCalledWith([
            { taskId: "t1", categoryId: "c1" },
            { taskId: "t2", categoryId: "c2" },
        ]);
        expect(logTasks).toHaveBeenCalledWith("Personal", ["gym"]);
        expect(result).toEqual({
            completedCount: 2,
            loggedCount: 1,
            failedCount: 0,
            confirmedCompletions: [
                { taskId: "t1", categoryId: "c1" },
                { taskId: "t2", categoryId: "c2" },
            ],
            remainingEntries: [],
        });
    });

    it("keeps failed entries and excludes failed completions from confirmations", async () => {
        const bulkComplete = vi.fn().mockResolvedValue({ totalCompleted: 1, totalFailed: 1, failedTaskIds: ["t2"] });
        const logTasks = vi.fn().mockResolvedValue({ tasksLogged: 1, currentStreak: 3, failedIndices: [0] });

        const result = await runEndOfDaySubmission(checked, ["a", "b"], "Personal", { bulkComplete, logTasks });

        expect(result.confirmedCompletions).toEqual([{ taskId: "t1", categoryId: "c1" }]);
        expect(result.remainingEntries).toEqual(["a"]);
        expect(result.failedCount).toBe(2);
    });

    it("skips the APIs entirely for empty inputs", async () => {
        const bulkComplete = vi.fn();
        const logTasks = vi.fn();

        const result = await runEndOfDaySubmission([], [], "Personal", { bulkComplete, logTasks });

        expect(bulkComplete).not.toHaveBeenCalled();
        expect(logTasks).not.toHaveBeenCalled();
        expect(result.failedCount).toBe(0);
    });

    it("trims and drops blank entries before logging", async () => {
        const bulkComplete = vi.fn();
        const logTasks = vi.fn().mockResolvedValue({ message: "ok", tasksLogged: 1, currentStreak: 1 });

        await runEndOfDaySubmission([], ["  gym  ", "   ", ""], "Personal", { bulkComplete, logTasks });

        expect(logTasks).toHaveBeenCalledWith("Personal", ["gym"]);
    });

    it("never fires a log request when every entry is blank", async () => {
        const bulkComplete = vi.fn();
        const logTasks = vi.fn();

        const result = await runEndOfDaySubmission([], ["  ", ""], "Personal", { bulkComplete, logTasks });

        expect(logTasks).not.toHaveBeenCalled();
        expect(result.loggedCount).toBe(0);
    });
});

describe("quickLogDoneKey", () => {
    it("keys by local calendar day, rolling over at midnight", () => {
        expect(quickLogDoneKey(new Date(2026, 5, 10, 23, 59))).toBe("quicklog-done-2026-06-10");
        expect(quickLogDoneKey(new Date(2026, 5, 11, 0, 1))).toBe("quicklog-done-2026-06-11");
    });
});
