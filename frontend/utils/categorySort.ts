import { Categories, Task } from "@/api/types";

export type SortOption = "task-count" | "alphabetical" | "due-date" | "start-date" | "priority";
export type SortDirection = "ascending" | "descending";

// Earliest valid timestamp among a date field across a category's tasks, or
// Infinity when none have one (so empty categories sort last on ascending).
const earliestTime = (tasks: Task[], field: "deadline" | "startDate"): number => {
    const times = tasks
        .map((t) => t[field])
        .filter((v): v is string => !!v)
        .map((v) => new Date(v).getTime());
    return times.length > 0 ? Math.min(...times) : Infinity;
};

/**
 * Returns a new array of categories ordered by the given option/direction.
 * Pure — does not mutate the input. Mirrors the comparators previously inline
 * in EditWorkspace's SortContent so workspace and tag views sort identically.
 */
export function sortCategories(
    categories: Categories[],
    option: SortOption,
    direction: SortDirection
): Categories[] {
    const isAscending = direction === "ascending";
    const sorted = [...categories];

    switch (option) {
        case "task-count":
            sorted.sort((a, b) =>
                isAscending ? a.tasks.length - b.tasks.length : b.tasks.length - a.tasks.length
            );
            break;
        case "alphabetical":
            sorted.sort((a, b) =>
                isAscending ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
            );
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
            // NOTE: preserved bug-for-bug from the original workspace sort — the
            // priority map is keyed by strings while task.priority is a number, so
            // this currently evaluates to 0 for every task (a no-op order). Kept
            // identical to avoid changing workspace behavior; fixing it is a
            // separate change.
            sorted.sort((a, b) => {
                const priorityMap: { [key: string]: number } = { high: 3, medium: 2, low: 1 };
                const aHighest = Math.max(...a.tasks.map((t) => priorityMap[t.priority] || 0), 0);
                const bHighest = Math.max(...b.tasks.map((t) => priorityMap[t.priority] || 0), 0);
                return isAscending ? aHighest - bHighest : bHighest - aHighest;
            });
            break;
    }

    return sorted;
}
