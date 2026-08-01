import type { CategoryDocument } from "@/hooks/useWorkspaces";

export type SortOption = "task-count" | "alphabetical" | "due-date" | "start-date" | "priority";
export type SortDirection = "ascending" | "descending";

// Earliest valid timestamp among a date field across a category's tasks, or
// Infinity when none have one (so empty categories sort last on ascending).
function earliestTime(tasks: CategoryDocument["tasks"], field: "deadline" | "startDate"): number {
  const times = tasks
    .map((t) => t[field])
    .filter((v): v is string => !!v)
    .map((v) => new Date(v).getTime());
  return times.length > 0 ? Math.min(...times) : Infinity;
}

// Highest task priority (0-3) in a category, or 0 if it has no tasks.
function highestPriority(tasks: CategoryDocument["tasks"]): number {
  return Math.max(0, ...tasks.map((t) => t.priority ?? 0));
}

// Returns a new array of categories ordered by the given option/direction.
// Pure — does not mutate the input. Ported from mobile's utils/categorySort.ts;
// mobile's "priority" sort compares a string-keyed map against a numeric
// task.priority (always 0), a no-op bug kept there for behavior parity — fixed
// here since desktop has no existing behavior to preserve.
export function sortCategories(
  categories: CategoryDocument[],
  option: SortOption,
  direction: SortDirection,
): CategoryDocument[] {
  const isAscending = direction === "ascending";
  const sorted = [...categories];

  switch (option) {
    case "task-count":
      sorted.sort((a, b) =>
        isAscending ? a.tasks.length - b.tasks.length : b.tasks.length - a.tasks.length,
      );
      break;
    case "alphabetical":
      sorted.sort((a, b) => (isAscending ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)));
      break;
    case "due-date":
      sorted.sort((a, b) => {
        const aT = earliestTime(a.tasks, "deadline");
        const bT = earliestTime(b.tasks, "deadline");
        return isAscending ? aT - bT : bT - aT;
      });
      break;
    case "start-date":
      sorted.sort((a, b) => {
        const aT = earliestTime(a.tasks, "startDate");
        const bT = earliestTime(b.tasks, "startDate");
        return isAscending ? aT - bT : bT - aT;
      });
      break;
    case "priority":
      sorted.sort((a, b) => {
        const aP = highestPriority(a.tasks);
        const bP = highestPriority(b.tasks);
        return isAscending ? aP - bP : bP - aP;
      });
      break;
  }

  return sorted;
}
