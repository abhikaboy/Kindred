import { useMemo } from "react";
import { useTasks } from "@/contexts/tasksContext";
import { countTasksByDay } from "@/utils/taskCountsByDay";

export { dayKey, fromDayKey, countTasksByDay } from "@/utils/taskCountsByDay";
export type { DayDensity } from "@/utils/taskCountsByDay";

export function useTaskCountsByDay(start: Date, end: Date) {
    const { allTasks } = useTasks();
    return useMemo(
        () => countTasksByDay(allTasks, start, end),
        [allTasks, start.getTime(), end.getTime()]
    );
}
