import type { CategoryDocument } from "@/hooks/useWorkspaces";
import { sortCategories, type SortDirection, type SortOption } from "@/lib/categorySort";
import { applyTaskFilters, type FilterState } from "@/lib/taskFilters";

const PROXY_CATEGORY_NAME = "!-proxy-!";

export const isUpcomingCategory = (c: CategoryDocument) => (c.id ?? "").startsWith("upcoming-");

export type OrderedWorkspaceCategories = {
  // Real categories, sorted then filtered; the list keyboard nav and shortcuts index into.
  categories: CategoryDocument[];
  upcoming: CategoryDocument | undefined;
};

// Mirrors mobile WorkspaceContent: sort on unfiltered tasks so filtering never
// reorders categories, and break count ties by name since backend order is unstable.
export function orderWorkspaceCategories(
  categories: CategoryDocument[],
  sort: { option: SortOption; direction: SortDirection } | null,
  filters: FilterState,
): OrderedWorkspaceCategories {
  const real = categories.filter((c) => c.name !== PROXY_CATEGORY_NAME && !isUpcomingCategory(c));
  const sorted = sort
    ? sortCategories(real, sort.option, sort.direction)
    : [...real].sort((a, b) => b.tasks.length - a.tasks.length || a.name.localeCompare(b.name));
  const upcoming = categories.find(isUpcomingCategory);
  return {
    categories: sorted.map((c) => ({ ...c, tasks: applyTaskFilters(c.tasks, filters) })),
    // Upcoming stays unfiltered, as on mobile: it previews templates, not real tasks.
    upcoming,
  };
}
