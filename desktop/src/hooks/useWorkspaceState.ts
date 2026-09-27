import { useCallback, useState } from "react";
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

type Prefs = { ws: string | undefined; sort: SortState; filters: FilterState; groupByDay: boolean };

function loadPrefs(ws: string | undefined): Prefs {
  return { ws, sort: loadSort(ws), filters: loadFilters(ws), groupByDay: loadGroupByDay(ws) };
}

export function useWorkspaceState(workspaceName: string | undefined) {
  const [stored, setStored] = useState<Prefs>(() => loadPrefs(workspaceName));

  // Prefs are tagged with their workspace and reloaded during render on a switch,
  // so the first render of /workspace/B never shows A's sort/filters.
  let prefs = stored;
  if (stored.ws !== workspaceName) {
    prefs = loadPrefs(workspaceName);
    setStored(prefs);
  }

  // Tap an option: unselected -> descending; same option -> ascending; tap
  // again -> clears back to the workspace's natural order.
  const selectSort = useCallback(
    (option: SortOption) => {
      if (!workspaceName) return;
      setStored((prev) => {
        const base = withWs(prev, workspaceName);
        const cur = base.sort;
        let next: SortState;
        if (cur?.option === option) {
          next = cur.direction === "descending" ? { option, direction: "ascending" } : null;
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
        return { ...base, sort: next };
      });
    },
    [workspaceName],
  );

  const toggleFilter = useCallback(
    (category: keyof FilterState, option: string) => {
      if (!workspaceName) return;
      setStored((prev) => {
        const base = withWs(prev, workspaceName);
        const group = base.filters[category] as Record<string, boolean>;
        const next: FilterState = {
          ...base.filters,
          [category]: { ...group, [option]: !group[option] },
        };
        localStorage.setItem(filtersKey(workspaceName), JSON.stringify(next));
        return { ...base, filters: next };
      });
    },
    [workspaceName],
  );

  const clearFilters = useCallback(() => {
    if (!workspaceName) return;
    localStorage.removeItem(filtersKey(workspaceName));
    setStored((prev) => ({ ...withWs(prev, workspaceName), filters: EMPTY_FILTERS }));
  }, [workspaceName]);

  const toggleGroupByDay = useCallback(() => {
    if (!workspaceName) return;
    setStored((prev) => {
      const base = withWs(prev, workspaceName);
      const next = !base.groupByDay;
      localStorage.setItem(groupKey(workspaceName), next ? "day" : "none");
      return { ...base, groupByDay: next };
    });
  }, [workspaceName]);

  return {
    sort: prefs.sort,
    selectSort,
    filters: prefs.filters,
    toggleFilter,
    clearFilters,
    groupByDay: prefs.groupByDay,
    toggleGroupByDay,
  };
}

// Guards an updater against a snapshot still tagged with another workspace.
function withWs(prev: Prefs, ws: string): Prefs {
  return prev.ws === ws ? prev : loadPrefs(ws);
}
