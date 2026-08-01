import { isFuture, isPast, isThisWeek, isToday } from "date-fns";
import type { TaskDocument } from "@/hooks/useWorkspaces";

export type FilterState = {
  priorities: { low: boolean; medium: boolean; high: boolean };
  deadlines: { overdue: boolean; today: boolean; thisWeek: boolean; future: boolean; none: boolean };
};

export const EMPTY_FILTERS: FilterState = {
  priorities: { low: false, medium: false, high: false },
  deadlines: { overdue: false, today: false, thisWeek: false, future: false, none: false },
};

export function hasActiveFilters(filters: FilterState): boolean {
  return Object.values(filters.priorities).some(Boolean) || Object.values(filters.deadlines).some(Boolean);
}

export function activeFilterCount(filters: FilterState): number {
  return (
    Object.values(filters.priorities).filter(Boolean).length +
    Object.values(filters.deadlines).filter(Boolean).length
  );
}

// Pure filter over a task list. Ported from mobile's useWorkspaceFilters.applyFilters.
export function applyTaskFilters(tasks: TaskDocument[], filters: FilterState): TaskDocument[] {
  const hasPriorityFilters = Object.values(filters.priorities).some(Boolean);
  const hasDeadlineFilters = Object.values(filters.deadlines).some(Boolean);
  if (!hasPriorityFilters && !hasDeadlineFilters) return tasks;

  return tasks.filter((task) => {
    let matchesPriority = !hasPriorityFilters;
    let matchesDeadline = !hasDeadlineFilters;

    if (hasPriorityFilters) {
      const p = task.priority;
      if (
        (filters.priorities.low && p === 1) ||
        (filters.priorities.medium && p === 2) ||
        (filters.priorities.high && p === 3)
      ) {
        matchesPriority = true;
      }
    }

    if (hasDeadlineFilters) {
      if (filters.deadlines.none && !task.deadline) {
        matchesDeadline = true;
      } else if (task.deadline) {
        const deadline = new Date(task.deadline);
        if (filters.deadlines.overdue && isPast(deadline) && !isToday(deadline)) matchesDeadline = true;
        if (filters.deadlines.today && isToday(deadline)) matchesDeadline = true;
        if (filters.deadlines.thisWeek && isThisWeek(deadline, { weekStartsOn: 0 })) matchesDeadline = true;
        if (
          filters.deadlines.future &&
          isFuture(deadline) &&
          !isToday(deadline) &&
          !isThisWeek(deadline, { weekStartsOn: 0 })
        ) {
          matchesDeadline = true;
        }
      }
    }

    return matchesPriority && matchesDeadline;
  });
}
