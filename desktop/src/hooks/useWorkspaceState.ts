import { useCallback, useEffect, useState } from "react";
import type { SortDirection, SortOption } from "@/lib/categorySort";
import { EMPTY_FILTERS, type FilterState } from "@/lib/taskFilters";

// Client-only workspace view prefs (sort/filter/group-by-day) — no backend
// concept of this, ported from mobile's AsyncStorage-backed equivalent but as
// plain localStorage + lifted state, since desktop keeps one component tree
// (mobile needed a pub/sub event bus to bridge separate screens).
export type SortState = { option: SortOption; direction: SortDirection } | null;

const sortKey = (ws: string) => `workspace-sort-${ws}`;
const filtersKey = (ws: string) => `workspace-filters-${ws}`;
const groupKey = (ws: string) => `workspace-group-${ws}`;

function loadSort(ws: string | undefined): SortState {
  if (!ws) return null;
  const option = localStorage.getItem(sortKey(ws)) as SortOption | null;
  if (!option) return null;
  const direction = (localStorage.getItem(sortKey(ws) + "-direction") as SortDirection | null) ?? "descending";
  return { option, direction };
}

function loadFilters(ws: string | undefined): FilterState {
  if (!ws) return EMPTY_FILTERS;
  try {
    const raw = localStorage.getItem(filtersKey(ws));
    return raw ? (JSON.parse(raw) as FilterState) : EMPTY_FILTERS;
  } catch {
    return EMPTY_FILTERS;
  }
}

function loadGroupByDay(ws: string | undefined): boolean {
  return !!ws && localStorage.getItem(groupKey(ws)) === "day";
}

export function useWorkspaceState(workspaceName: string | undefined) {
  const [sort, setSort] = useState<SortState>(() => loadSort(workspaceName));
  const [filters, setFilters] = useState<FilterState>(() => loadFilters(workspaceName));
  const [groupByDay, setGroupByDay] = useState<boolean>(() => loadGroupByDay(workspaceName));

  // Reload when the user switches workspaces (each has independent prefs).
  useEffect(() => {
    setSort(loadSort(workspaceName));
    setFilters(loadFilters(workspaceName));
    setGroupByDay(loadGroupByDay(workspaceName));
  }, [workspaceName]);

  // Tap an option: unselected -> descending; same option -> ascending; tap
  // again -> clears back to the workspace's natural order.
  const selectSort = useCallback(
    (option: SortOption) => {
      if (!workspaceName) return;
      setSort((prev) => {
        let next: SortState;
        if (prev?.option === option) {
          next = prev.direction === "descending" ? { option, direction: "ascending" } : null;
        } else {
          next = { option, direction: "descending" };
        }
        if (next) {
          localStorage.setItem(sortKey(workspaceName), next.option);
          localStorage.setItem(sortKey(workspaceName) + "-direction", next.direction);
        } else {
          localStorage.removeItem(sortKey(workspaceName));
          localStorage.removeItem(sortKey(workspaceName) + "-direction");
        }
        return next;
      });
    },
    [workspaceName],
  );

  const toggleFilter = useCallback(
    (category: keyof FilterState, option: string) => {
      if (!workspaceName) return;
      setFilters((prev) => {
        const group = prev[category] as Record<string, boolean>;
        const next: FilterState = {
          ...prev,
          [category]: { ...group, [option]: !group[option] },
        };
        localStorage.setItem(filtersKey(workspaceName), JSON.stringify(next));
        return next;
      });
    },
    [workspaceName],
  );

  const clearFilters = useCallback(() => {
    if (!workspaceName) return;
    setFilters(EMPTY_FILTERS);
    localStorage.removeItem(filtersKey(workspaceName));
  }, [workspaceName]);

  const toggleGroupByDay = useCallback(() => {
    if (!workspaceName) return;
    setGroupByDay((prev) => {
      const next = !prev;
      localStorage.setItem(groupKey(workspaceName), next ? "day" : "none");
      return next;
    });
  }, [workspaceName]);

  return { sort, selectSort, filters, toggleFilter, clearFilters, groupByDay, toggleGroupByDay };
}
