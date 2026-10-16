import { useMemo } from "react";
import { useTasks } from "@/contexts/tasksContext";
import { countTasksByDay } from "@/utils/taskCountsByDay";
import { projectRecurringTasks } from "@/utils/recurrenceProjection";

export { dayKey, fromDayKey, countTasksByDay } from "@/utils/taskCountsByDay";
export type { DayDensity } from "@/utils/taskCountsByDay";

export function useTaskCountsByDay(start: Date, end: Date) {
    const { allTasks, templates } = useTasks();
    return useMemo(
        () => countTasksByDay([...allTasks, ...projectRecurringTasks(allTasks, templates, start, end)], start, end),
        [allTasks, templates, start.getTime(), end.getTime()]
    );
}
