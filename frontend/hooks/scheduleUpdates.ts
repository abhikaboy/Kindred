import type { ParsedRecurrence, ParsedSchedule } from "@shared/taskSuggest";

export type ScheduleUpdate = {
    startDate?: Date;
    startTime?: Date;
    deadline?: Date;
    recurrence?: ParsedRecurrence;
};

// What the parser last wrote, so it can correct itself without ever overwriting
// a value the user chose. ISO strings, since Date identity is not comparable.
export type AppliedSchedule = {
    startDate: string | null;
    deadline: string | null;
    recurring: boolean;
};

export const noAppliedSchedule = (): AppliedSchedule => ({ startDate: null, deadline: null, recurring: false });

// Deliberately free of any API/native import so tests can load it directly.
/**
 * Pure: which schedule fields a parse may fill.
 *
 * A field is the parser's to rewrite when it is still at its default OR still
 * holds exactly what the parser last wrote. Typing streams partial parses
 * ("gym tomorrow" before "gym tomorrow 7-8am"), so without the second clause the
 * first partial would stick. Anything the user set fails both clauses.
 */
export function scheduleUpdates(
    current: {
        startDate: Date | null;
        startTime: Date | null;
        deadline: Date | null;
        recurring: boolean;
        flexDetails: unknown | null;
    },
    schedule: ParsedSchedule | null,
    recurrence: ParsedRecurrence | null,
    applied: AppliedSchedule,
): { update: ScheduleUpdate; applied: AppliedSchedule } {
    const update: ScheduleUpdate = {};
    const nextApplied = { ...applied };

    const startIso = current.startDate ? current.startDate.toISOString() : null;
    const ownsStart = startIso === null || startIso === applied.startDate;
    if (schedule?.startDate && ownsStart && startIso !== schedule.startDate) {
        update.startDate = new Date(schedule.startDate);
        if (schedule.startTime) update.startTime = new Date(schedule.startTime);
        nextApplied.startDate = schedule.startDate;
    } else if (!ownsStart) {
        nextApplied.startDate = null;
    }

    const endIso = current.deadline ? current.deadline.toISOString() : null;
    const ownsEnd = endIso === null || endIso === applied.deadline;
    if (schedule?.deadline && ownsEnd && endIso !== schedule.deadline) {
        update.deadline = new Date(schedule.deadline);
        nextApplied.deadline = schedule.deadline;
    } else if (!ownsEnd) {
        nextApplied.deadline = null;
    }

    const ownsRecurrence = !current.recurring || applied.recurring;
    if (recurrence && ownsRecurrence && !current.flexDetails) {
        update.recurrence = recurrence;
        nextApplied.recurring = true;
    } else if (current.recurring && !applied.recurring) {
        nextApplied.recurring = false;
    }

    return { update, applied: nextApplied };
}
