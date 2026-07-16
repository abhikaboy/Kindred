import { addDays, isSameDay } from "date-fns";
import { dayKey } from "@/lib/taskCountsByDay";
import type { TaskDocument } from "@/hooks/useWorkspaces";

export type WeekDayTasks = { timed: TaskDocument[]; allDay: TaskDocument[] };

export { dayKey } from "@/lib/taskCountsByDay";

// For the 7 days from weekStart: `timed` = has a startTime on that day; `allDay`
// = no startTime but a startDate/deadline on that day.
export function tasksForWeek(allTasks: TaskDocument[], weekStart: Date): Record<string, WeekDayTasks> {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const out: Record<string, WeekDayTasks> = {};
  for (const day of days) out[dayKey(day)] = { timed: [], allDay: [] };
  for (const t of allTasks) {
    for (const day of days) {
      const bucket = out[dayKey(day)];
      if (t.startTime && isSameDay(new Date(t.startTime), day)) {
        bucket.timed.push(t);
      } else if (
        !t.startTime &&
        ((t.startDate && isSameDay(new Date(t.startDate), day)) ||
          (t.deadline && isSameDay(new Date(t.deadline), day)))
      ) {
        bucket.allDay.push(t);
      }
    }
  }
  return out;
}
