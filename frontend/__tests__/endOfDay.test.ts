import {
    END_OF_DAY_HOUR,
    endOfDayDismissKey,
    isEndOfDayWindow,
    todaysOpenTasks,
    runEndOfDaySubmission,
} from "@/utils/endOfDay";
import { Task } from "@/api/types";

const task = (over: Partial<Task>): Task =>
    ({ id: "t", content: "", priority: 1, value: 1, categoryID: "cat-1", ...(over as any) }) as Task;

describe("isEndOfDayWindow", () => {
    it("is false before the trigger hour", () => {
        expect(isEndOfDayWindow(new Date(2026, 5, 10, END_OF_DAY_HOUR - 1, 59))).toBe(false);
        expect(isEndOfDayWindow(new Date(2026, 5, 10, 12, 0))).toBe(false);
    });

    it("is true from 8PM through the early morning", () => {
        expect(isEndOfDayWindow(new Date(2026, 5, 10, END_OF_DAY_HOUR, 0))).toBe(true);
        expect(isEndOfDayWindow(new Date(2026, 5, 10, 23, 59))).toBe(true);
        expect(isEndOfDayWindow(new Date(2026, 5, 11, 0, 1))).toBe(true);
        expect(isEndOfDayWindow(new Date(2026, 5, 11, 5, 59))).toBe(true);
    });

    it("closes at 6AM", () => {
        expect(isEndOfDayWindow(new Date(2026, 5, 11, 6, 0))).toBe(false);
    });
});

describe("endOfDayDismissKey", () => {
    it("encodes the local date in the evening", () => {
        expect(endOfDayDismissKey(new Date(2026, 5, 10, 21, 0))).toBe("eod-dismissed-2026-06-10");
    });

    it("anchors post-midnight hours to the evening the window opened", () => {
        expect(endOfDayDismissKey(new Date(2026, 5, 11, 1, 0))).toBe("eod-dismissed-2026-06-10");
    });

    it("differs across nights so the card returns the next evening", () => {
        expect(endOfDayDismissKey(new Date(2026, 5, 10, 21))).not.toBe(endOfDayDismissKey(new Date(2026, 5, 11, 21)));
    });
});

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
        const bulkComplete = jest.fn().mockResolvedValue({ totalCompleted: 2, totalFailed: 0, failedTaskIds: [] });
        const logTasks = jest.fn().mockResolvedValue({ tasksLogged: 1, currentStreak: 3 });

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
        const bulkComplete = jest.fn().mockResolvedValue({ totalCompleted: 1, totalFailed: 1, failedTaskIds: ["t2"] });
        const logTasks = jest.fn().mockResolvedValue({ tasksLogged: 1, currentStreak: 3, failedIndices: [0] });

        const result = await runEndOfDaySubmission(checked, ["a", "b"], "Personal", { bulkComplete, logTasks });

        expect(result.confirmedCompletions).toEqual([{ taskId: "t1", categoryId: "c1" }]);
        expect(result.remainingEntries).toEqual(["a"]);
        expect(result.failedCount).toBe(2);
    });

    it("skips the APIs entirely for empty inputs", async () => {
        const bulkComplete = jest.fn();
        const logTasks = jest.fn();

        const result = await runEndOfDaySubmission([], [], "Personal", { bulkComplete, logTasks });

        expect(bulkComplete).not.toHaveBeenCalled();
        expect(logTasks).not.toHaveBeenCalled();
        expect(result.failedCount).toBe(0);
    });

    it("trims and drops blank entries before logging", async () => {
        const bulkComplete = jest.fn();
        const logTasks = jest.fn().mockResolvedValue({ message: "ok", tasksLogged: 1, currentStreak: 1 });

        await runEndOfDaySubmission([], ["  gym  ", "   ", ""], "Personal", { bulkComplete, logTasks });

        expect(logTasks).toHaveBeenCalledWith("Personal", ["gym"]);
    });

    it("never fires a log request when every entry is blank", async () => {
        const bulkComplete = jest.fn();
        const logTasks = jest.fn();

        const result = await runEndOfDaySubmission([], ["  ", ""], "Personal", { bulkComplete, logTasks });

        expect(logTasks).not.toHaveBeenCalled();
        expect(result.loggedCount).toBe(0);
    });
});
