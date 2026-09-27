// End-of-day "Quick log my day" logic, shared by mobile and desktop.

type ReviewTask = {
    id: string;
    categoryID?: string;
    startDate?: string;
    deadline?: string;
};

export type BulkCompleteResult = {
    totalCompleted: number;
    totalFailed: number;
    failedTaskIds?: string[];
};

export type LogTasksResult = {
    tasksLogged: number;
    failedIndices?: number[];
};

const startOfLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

// Per calendar day (local time): the Home quick log hides once it's been completed today.
export function quickLogDoneKey(now: Date): string {
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `quicklog-done-${now.getFullYear()}-${month}-${day}`;
}

// Open tasks worth reviewing: starting today, due today, or overdue.
// Synthetic "Upcoming" categories aren't real categories and can't be completed.
export function todaysOpenTasks<T extends ReviewTask>(allTasks: T[], now: Date = new Date()): T[] {
    const today = startOfLocalDay(now);
    const seen = new Set<string>();
    const result: T[] = [];
    for (const t of allTasks) {
        if (!t.id || seen.has(t.id)) continue;
        if (t.categoryID?.startsWith("upcoming-")) continue;

        const startsToday = t.startDate ? startOfLocalDay(new Date(t.startDate)) === today : false;
        const deadlineDay = t.deadline ? startOfLocalDay(new Date(t.deadline)) : null;
        const dueToday = deadlineDay === today;
        const overdue = deadlineDay !== null && deadlineDay < today;

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

export async function runEndOfDaySubmission(
    checkedTasks: ReviewTask[],
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

    // The backend rejects empty content, so an all-blank list must not fire a request.
    const cleaned = entries.map((e) => e.trim()).filter(Boolean);
    if (cleaned.length > 0 && workspaceName) {
        const res = await deps.logTasks(workspaceName, cleaned);
        loggedCount = res.tasksLogged;
        const failedIdx = new Set(res.failedIndices ?? []);
        failedCount += failedIdx.size;
        remainingEntries = cleaned.filter((_, i) => failedIdx.has(i));
    }

    return { completedCount, loggedCount, failedCount, confirmedCompletions, remainingEntries };
}
