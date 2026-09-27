import { useCallback, useSyncExternalStore } from "react";
import { startOfDay, addDays, startOfWeek, endOfWeek } from "date-fns";
import { Task } from "@/api/types";
import { getWorkspaceViewState, subscribeWorkspaceViewState } from "@/hooks/workspaceViewStateStore";

export type FilterState = {
    priorities: { low: boolean; medium: boolean; high: boolean };
    deadlines: { overdue: boolean; today: boolean; thisWeek: boolean; future: boolean; none: boolean };
};

/**
 * Pure filter used by useWorkspaceFilters. Date boundaries are computed once per
 * call (not per task) and are equivalent to the date-fns isPast/isToday/
 * isThisWeek/isFuture checks this replaced.
 */
export const filterTasks = (tasks: Task[], filters: FilterState | null, now: Date = new Date()): Task[] => {
    if (!filters) return tasks;

    const hasPriorityFilters = Object.values(filters.priorities).some((v) => v);
    const hasDeadlineFilters = Object.values(filters.deadlines).some((v) => v);

    if (!hasPriorityFilters && !hasDeadlineFilters) {
        return tasks;
    }

    const todayStart = startOfDay(now).getTime();
    const tomorrowStart = startOfDay(addDays(now, 1)).getTime();
    const weekStart = startOfWeek(now, { weekStartsOn: 0 }).getTime();
    const weekEnd = endOfWeek(now, { weekStartsOn: 0 }).getTime();

    return tasks.filter((task) => {
        let matchesPriority = !hasPriorityFilters;
        let matchesDeadline = !hasDeadlineFilters;

        if (hasPriorityFilters) {
            // Priority is stored as a number: 1 = low, 2 = medium, 3 = high
            const taskPriority = task.priority;
            if (
                (filters.priorities.low && taskPriority === 1) ||
                (filters.priorities.medium && taskPriority === 2) ||
                (filters.priorities.high && taskPriority === 3)
            ) {
                matchesPriority = true;
            }
        }

        if (hasDeadlineFilters) {
            if (filters.deadlines.none && !task.deadline) {
                matchesDeadline = true;
            } else if (task.deadline) {
                const t = new Date(task.deadline).getTime();
                const isTodayT = t >= todayStart && t < tomorrowStart;
                const isThisWeekT = t >= weekStart && t <= weekEnd;

                if (filters.deadlines.overdue && t < todayStart) {
                    matchesDeadline = true;
                }
                if (filters.deadlines.today && isTodayT) {
                    matchesDeadline = true;
                }
                if (filters.deadlines.thisWeek && isThisWeekT) {
                    matchesDeadline = true;
                }
                if (filters.deadlines.future && t > weekEnd) {
                    matchesDeadline = true;
                }
            }
        }

        return matchesPriority && matchesDeadline;
    });
};

export const useWorkspaceFilters = (workspaceName: string) => {
    const filters = useSyncExternalStore(
        subscribeWorkspaceViewState,
        () => getWorkspaceViewState(workspaceName).filters as FilterState | null
    );

    const applyFilters = useCallback((tasks: Task[]): Task[] => filterTasks(tasks, filters), [filters]);

    return { filters, applyFilters };
};
