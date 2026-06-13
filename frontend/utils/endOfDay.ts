import { isSameDay, startOfDay } from "date-fns";
import type { Task } from "@/api/types";
import type { BulkCompleteResult, LogTasksResult } from "@/api/task";

export const END_OF_DAY_HOUR = 20;

export function isEndOfDayWindow(now: Date): boolean {
    return now.getHours() >= END_OF_DAY_HOUR;
}

export function endOfDayDismissKey(now: Date): string {
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `eod-dismissed-${now.getFullYear()}-${month}-${day}`;
}

// Open tasks worth reviewing tonight: starting today, due today, or overdue.
// Synthetic "Upcoming" categories aren't real categories and can't be completed.
export function todaysOpenTasks(allTasks: Task[], now: Date = new Date()): Task[] {
    const seen = new Set<string>();
    const result: Task[] = [];
    for (const t of allTasks) {
        if (!t.id || seen.has(t.id)) continue;
        if (t.categoryID?.startsWith("upcoming-")) continue;

        const startsToday = t.startDate ? isSameDay(new Date(t.startDate), now) : false;
        const dueToday = t.deadline ? isSameDay(new Date(t.deadline), now) : false;
        const overdue = t.deadline ? startOfDay(new Date(t.deadline)) < startOfDay(now) : false;

        if (startsToday || dueToday || overdue) {
            seen.add(t.id);
            result.push(t);
        }
    }
    return result;
}

export interface EndOfDaySubmissionDeps {
    bulkComplete: (items: { taskId: string; categoryId: string }[]) => Promise<BulkCompleteResult>;
    logTasks: (workspaceName: string, contents: string[]) => Promise<LogTasksResult>;
}

export interface EndOfDaySubmissionResult {
    completedCount: number;
    loggedCount: number;
    failedCount: number;
    confirmedCompletions: { taskId: string; categoryId: string }[];
    remainingEntries: string[];
}

// The sheet's submit step, kept pure (deps injected) so it's unit-testable
// without rendering the gorhom bottom sheet.
export async function runEndOfDaySubmission(
    checkedTasks: Task[],
    entries: string[],
    workspaceName: string | undefined,
    deps: EndOfDaySubmissionDeps
): Promise<EndOfDaySubmissionResult> {
    let completedCount = 0;
    let loggedCount = 0;
    let failedCount = 0;
    const confirmedCompletions: { taskId: string; categoryId: string }[] = [];
    // Entries are only cleared once the log call confirms them.
    let remainingEntries: string[] = entries;

    if (checkedTasks.length > 0) {
        const res = await deps.bulkComplete(checkedTasks.map((t) => ({ taskId: t.id, categoryId: t.categoryID! })));
        const failed = new Set(res.failedTaskIds ?? []);
        for (const t of checkedTasks) {
            if (!failed.has(t.id)) confirmedCompletions.push({ taskId: t.id, categoryId: t.categoryID! });
        }
        completedCount = res.totalCompleted;
        failedCount += res.totalFailed;
    }

    if (entries.length > 0 && workspaceName) {
        const res = await deps.logTasks(workspaceName, entries);
        loggedCount = res.tasksLogged;
        const failedIdx = new Set(res.failedIndices ?? []);
        failedCount += failedIdx.size;
        remainingEntries = entries.filter((_, i) => failedIdx.has(i));
    }

    return { completedCount, loggedCount, failedCount, confirmedCompletions, remainingEntries };
}
