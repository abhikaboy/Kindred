import type { ParsedRecurrence, ParsedSchedule } from "@shared/taskSuggest";

export type ScheduleUpdate = {
    startDate?: Date;
    startTime?: Date;
    deadline?: Date;
    recurrence?: ParsedRecurrence;
};

// Deliberately free of any API/native import so tests can load it directly.
/**
 * Pure: which schedule fields a parse may fill, given what the form already holds.
 * Only fields still at their default are offered, so a hand-set date is never
 * clobbered. An empty object means nothing to apply.
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
): ScheduleUpdate {
    const update: ScheduleUpdate = {};

    if (schedule?.startDate && current.startDate === null && current.startTime === null) {
        update.startDate = new Date(schedule.startDate);
        if (schedule.startTime) update.startTime = new Date(schedule.startTime);
    }
    if (schedule?.deadline && current.deadline === null) {
        update.deadline = new Date(schedule.deadline);
    }
    if (recurrence && !current.recurring && !current.flexDetails) {
        update.recurrence = recurrence;
    }

    return update;
}
