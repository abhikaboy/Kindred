import { useCallback, useSyncExternalStore } from "react";
import {
    getWorkspaceViewState,
    subscribeWorkspaceViewState,
    WorkspaceFilters,
    WorkspaceSortOption,
    WorkspaceState,
} from "@/hooks/workspaceViewStateStore";

export type { WorkspaceFilters, WorkspaceSortOption, WorkspaceState };

export const useWorkspaceState = (workspaceName: string) => {
    // Keyed by name, so the first frame after a workspace switch already shows
    // that workspace's settings (never the previous one's).
    const state = useSyncExternalStore(subscribeWorkspaceViewState, () => getWorkspaceViewState(workspaceName));

    const getFilterDescription = (): string | null => {
        if (!state.filters) return null;

        const parts: string[] = [];

        // Priority filters
        const priorities = Object.entries(state.filters.priorities)
            .filter(([_, active]) => active)
            .map(([key, _]) => key.charAt(0).toUpperCase() + key.slice(1));

        if (priorities.length > 0) {
            parts.push(`Priority: ${priorities.join(", ")}`);
        }

        // Deadline filters
        const deadlines = Object.entries(state.filters.deadlines)
            .filter(([_, active]) => active)
            .map(([key, _]) => {
                const labels: Record<string, string> = {
                    overdue: "Waiting",
                    today: "Today",
                    thisWeek: "This Week",
                    future: "Future",
                    none: "No Deadline",
                };
                return labels[key] || key;
            });

        if (deadlines.length > 0) {
            parts.push(`Deadline: ${deadlines.join(", ")}`);
        }

        return parts.length > 0 ? parts.join(" • ") : null;
    };

    const getSortDescription = (): string | null => {
        if (!state.sort) return null;

        const labels: Record<WorkspaceSortOption & string, string> = {
            "task-count": "Sorted by Task Count",
            "alphabetical": "Sorted Alphabetically",
            "due-date": "Sorted by Due Date",
            "start-date": "Sorted by Start Date",
            "priority": "Sorted by Priority",
        };

        const sortLabel = labels[state.sort] || null;
        if (sortLabel && state.sortDirection) {
            const directionLabel = state.sortDirection === "ascending" ? "Asc" : "Desc";
            return `${sortLabel} (${directionLabel})`;
        }

        return sortLabel;
    };

    const getStateDescription = useCallback((): string => {
        const parts: string[] = [];

        // Always include visibility status
        parts.push(state.isPublic ? "Public Workspace" : "Private Workspace");

        // Add filter description
        const filterDesc = getFilterDescription();
        if (filterDesc) {
            parts.push(filterDesc);
        }

        // Add sort description
        const sortDesc = getSortDescription();
        if (sortDesc) {
            parts.push(sortDesc);
        }

        if (state.groupByDay) {
            parts.push("Grouped by Day");
        }


        return parts.join(" • ");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state]);

    return {
        state,
        hasActiveState: state.filters !== null || state.sort !== null || state.groupByDay,
        getStateDescription,
    };
};
