import { useMemo } from "react";
import { useAllTasks } from "@/hooks/useHomeTasks";
import { countTasksByDay, type DayDensity } from "@/lib/taskCountsByDay";

export { dayKey, fromDayKey } from "@/lib/taskCountsByDay";
export type { DayDensity };

export function useTaskCountsByDay(start: Date, end: Date): Record<string, DayDensity> {
  const allTasks = useAllTasks();
  return useMemo(
    () => countTasksByDay(allTasks, start, end),
    [allTasks, start.getTime(), end.getTime()]
  );
}
