import { addDays, isSameDay, startOfDay, differenceInCalendarDays } from "date-fns";
import { dayKey } from "@/lib/taskCountsByDay";
import type { TaskDocument } from "@/hooks/useWorkspaces";

export type WeekDayTasks = { timed: TaskDocument[]; allDay: TaskDocument[] };

export { dayKey } from "@/lib/taskCountsByDay";

// True when the task spans multiple calendar days (start day strictly before deadline day).
export function isMultiDay(task: TaskDocument): boolean {
  const startIso = task.startTime ?? task.startDate;
  if (!startIso || !task.deadline) return false;
  const startDay = startOfDay(new Date(startIso));
  const deadlineDay = startOfDay(new Date(task.deadline));
  return deadlineDay > startDay;
}

// Per-day buckets for the 7 days from weekStart. Multi-day tasks are excluded;
// they render as spanning bars via spanningTasksForWeek.
export function tasksForWeek(allTasks: TaskDocument[], weekStart: Date): Record<string, WeekDayTasks> {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const out: Record<string, WeekDayTasks> = {};
  for (const day of days) out[dayKey(day)] = { timed: [], allDay: [] };
  for (const t of allTasks) {
    if (isMultiDay(t)) continue;
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

export type SpanningBar = {
  task: TaskDocument;
  startCol: number;      // 0..6 within the visible week
  endCol: number;        // 0..6, always >= startCol
  clippedLeft: boolean;  // task starts before weekStart (day 0)
  clippedRight: boolean; // task ends after the last visible day (day 6)
  row: number;           // 0-based lane for vertical stacking (no column overlap within a row)
};

// Multi-day tasks whose [startDay, deadlineDay] intersects the visible week, laid out into rows.
export function spanningTasksForWeek(allTasks: TaskDocument[], weekStart: Date): SpanningBar[] {
  const day0 = startOfDay(weekStart);
  const day6 = addDays(day0, 6);

  const bars: Omit<SpanningBar, "row">[] = [];
  for (const task of allTasks) {
    if (!isMultiDay(task)) continue;
    const startIso = task.startTime ?? task.startDate;
    if (!startIso || !task.deadline) continue;

    const startDay = startOfDay(new Date(startIso));
    const deadlineDay = startOfDay(new Date(task.deadline));

    // Skip tasks entirely outside the visible week
    if (deadlineDay < day0 || startDay > day6) continue;

    const clippedLeft = startDay < day0;
    const clippedRight = deadlineDay > day6;
    const startCol = Math.max(0, Math.min(6, differenceInCalendarDays(startDay, day0)));
    const endCol = Math.max(0, Math.min(6, differenceInCalendarDays(deadlineDay, day0)));

    bars.push({ task, startCol, endCol, clippedLeft, clippedRight });
  }

  // Sort by startCol, then endCol; assign rows greedily (no column overlap within a row).
  bars.sort((a, b) => a.startCol - b.startCol || a.endCol - b.endCol);

  const rowEnds: number[] = []; // last endCol used per row
  const result: SpanningBar[] = [];

  for (const bar of bars) {
    let row = rowEnds.findIndex((end) => end < bar.startCol);
    if (row === -1) {
      row = rowEnds.length;
      rowEnds.push(bar.endCol);
    } else {
      rowEnds[row] = bar.endCol;
    }
    result.push({ ...bar, row });
  }

  return result;
}
