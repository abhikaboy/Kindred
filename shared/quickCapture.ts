/**
 * Quick capture: turning one line of typed text into a task.
 *
 * The only thing the user supplies is the content. Everything else is inferred
 * — the schedule from the text itself, priority and difficulty from the suggest
 * endpoint — and the category is left to the backend's auto-categorizer.
 */

import type { ParsedRecurrence, ParsedSchedule } from "./taskSuggest";

/** The subset of the suggest endpoint's response quick capture applies. */
export type FieldSuggestion = {
    priority?: number;
    value?: number;
};

/**
 * Mirrors the CreateTaskParams fields quick capture sets. Typed structurally
 * rather than against the generated client so this stays importable from both
 * apps and from tests.
 */
export type QuickCaptureTask = {
    content: string;
    priority: number;
    value: number;
    public: boolean;
    active: boolean;
    recurring: boolean;
    startDate?: string;
    startTime?: string;
    deadline?: string;
    recurFrequency?: string;
    recurDetails?: ParsedRecurrence["recurDetails"];
};

const DEFAULT_PRIORITY = 1;
const DEFAULT_VALUE = 1;

/**
 * Pure: assembles the create-task body. `now` is injected so the monthly
 * anchoring below is testable.
 */
export function buildQuickCaptureTask(
    content: string,
    schedule: ParsedSchedule | null,
    recurrence: ParsedRecurrence | null,
    fuzzy: FieldSuggestion | null,
    now: Date = new Date()
): QuickCaptureTask {
    const task: QuickCaptureTask = {
        content: content.trim(),
        priority: fuzzy?.priority ?? DEFAULT_PRIORITY,
        value: fuzzy?.value ?? DEFAULT_VALUE,
        public: true,
        active: false,
        recurring: recurrence !== null,
    };

    if (schedule?.startDate) task.startDate = schedule.startDate;
    if (schedule?.startTime) task.startTime = schedule.startTime;
    if (schedule?.deadline) task.deadline = schedule.deadline;

    if (recurrence) {
        task.recurFrequency = recurrence.recurFrequency;
        // The backend rejects a monthly recurrence without daysOfMonth, and
        // quick capture has no UI to ask, so anchor it on today.
        task.recurDetails =
            recurrence.recurFrequency === "monthly" && !recurrence.recurDetails.daysOfMonth
                ? { ...recurrence.recurDetails, daysOfMonth: [now.getDate()] }
                : recurrence.recurDetails;
    }

    return task;
}

/**
 * The human-readable tail of the confirmation line: what was inferred, in the
 * order the user is most likely to want to check it.
 */
export function describeEnrichment(scheduleLabel: string, priority?: number): string {
    const PRIORITY_LABEL: Record<number, string> = {
        1: "Low priority",
        2: "Medium priority",
        3: "High priority",
    };

    return [scheduleLabel, priority ? PRIORITY_LABEL[priority] : "", "sorting into a category"]
        .filter(Boolean)
        .join(" · ");
}
