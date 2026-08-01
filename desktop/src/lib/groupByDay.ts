import { format, isToday, isTomorrow, parseISO } from "date-fns";
import type { CategoryDocument, TaskDocument } from "@/hooks/useWorkspaces";

export type DayGroup = {
  key: string;
  label: string;
  date: Date | null;
  tasks: { task: TaskDocument; categoryId: string }[];
};

function labelFor(date: Date): string {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEE, MMM d");
}

// Flattens every category's (already-filtered) tasks into date buckets,
// sorted chronologically with undated tasks last. Ported from mobile's
// WorkspaceContent groupedByDay memo.
export function groupTasksByDay(categories: CategoryDocument[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();

  for (const category of categories) {
    for (const task of category.tasks) {
      const dateValue = task.startDate || task.deadline;
      let key = "no-date";
      let date: Date | null = null;
      let label = "No Date";

      if (dateValue) {
        const parsed = parseISO(dateValue);
        if (!Number.isNaN(parsed.getTime())) {
          key = format(parsed, "yyyy-MM-dd");
          date = parsed;
          label = labelFor(parsed);
        }
      }

      if (!groups.has(key)) groups.set(key, { key, label, date, tasks: [] });
      groups.get(key)!.tasks.push({ task, categoryId: category.id });
    }
  }

  return Array.from(groups.values()).sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.getTime() - b.date.getTime();
  });
}
