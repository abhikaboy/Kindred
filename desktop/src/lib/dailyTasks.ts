import { isSameDay, startOfDay, isWithinInterval } from "date-fns";
import type { TaskDocument } from "@/hooks/useWorkspaces";

export type DailyBuckets = {
  tasksForSelectedDate: TaskDocument[];
  tasksWithSpecificTime: TaskDocument[];
  tasksForTodayNoTime: TaskDocument[];
  tasksUnscheduled: TaskDocument[];
  listUnscheduledTasks: TaskDocument[];
  upcomingTasks: TaskDocument[];
  openTasks: TaskDocument[];
  overdueTasks: TaskDocument[];
};

export function categorizeDailyTasks(allTasks: TaskDocument[], selectedDate: Date): DailyBuckets {
  const tasksForSelectedDate = allTasks.filter((t) => {
    if (t.startDate && isSameDay(new Date(t.startDate), selectedDate)) return true;
    if (t.deadline && isSameDay(new Date(t.deadline), selectedDate)) return true;
    if (t.startDate && t.deadline) {
      return isWithinInterval(selectedDate, { start: new Date(t.startDate), end: new Date(t.deadline) });
    }
    return false;
  });

  const tasksWithSpecificTime = tasksForSelectedDate.filter((t) => Boolean(t.startTime));
  const tasksForTodayNoTime = tasksForSelectedDate.filter((t) => !t.startTime);
  const tasksUnscheduled = tasksForSelectedDate.filter((t) => !t.startDate && !t.startTime);
  const listUnscheduledTasks = allTasks.filter((t) => !t.startDate && !t.deadline);

  const today = startOfDay(new Date());
  const day = (iso: string) => startOfDay(new Date(iso));

  const upcomingTasks = allTasks.filter((t) => {
    if (t.startDate && !t.deadline && day(t.startDate) > today) return true;
    if (t.deadline && !t.startDate && day(t.deadline) > today) return true;
    if (t.startDate && t.deadline) return day(t.startDate) <= today && day(t.deadline) > today;
    if (t.startDate && day(t.startDate) > today) return true;
    return false;
  });

  const openTasks = allTasks.filter((t) => t.startDate && !t.deadline && day(t.startDate) < today);
  const overdueTasks = allTasks.filter((t) => t.deadline && day(t.deadline) < today);

  return {
    tasksForSelectedDate,
    tasksWithSpecificTime,
    tasksForTodayNoTime,
    tasksUnscheduled,
    listUnscheduledTasks,
    upcomingTasks,
    openTasks,
    overdueTasks,
  };
}
