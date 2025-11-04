import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type WorkspaceFilters = {
    priorities: { low: boolean; medium: boolean; high: boolean };
    deadlines: { overdue: boolean; today: boolean; thisWeek: boolean; future: boolean; none: boolean };
};

export type WorkspaceSortOption = "task-count" | "alphabetical" | "due-date" | "start-date" | "priority" | null;

export type WorkspaceState = {
    filters: WorkspaceFilters | null;
    sort: WorkspaceSortOption;
    sortDirection: "ascending" | "descending" | null;
    isPublic: boolean;
};

export const useWorkspaceState = (workspaceName: string) => {
    const [state, setState] = useState<WorkspaceState>({
        filters: null,
        sort: null,
        sortDirection: null,
        isPublic: true,
    });

    useEffect(() => {
        const loadState = async () => {
            try {
                const [filtersData, sortData, sortDirectionData, visibilityData] = await Promise.all([
                    AsyncStorage.getItem(`workspace-filters-${workspaceName}`),
                    AsyncStorage.getItem(`workspace-sort-${workspaceName}`),
                    AsyncStorage.getItem(`workspace-sort-direction-${workspaceName}`),
                    AsyncStorage.getItem(`workspace-visibility-${workspaceName}`),
                ]);

                const filters = filtersData ? JSON.parse(filtersData) : null;
                const sort = sortData ? (sortData as WorkspaceSortOption) : null;
                const sortDirection = sortDirectionData ? (sortDirectionData as "ascending" | "descending") : null;
                const isPublic = visibilityData !== null ? visibilityData === "public" : true;

                setState({ filters, sort, sortDirection, isPublic });
            } catch (error) {
                console.error("Error loading workspace state:", error);
            }
        };

        loadState();

        // Poll for changes every second
        const interval = setInterval(loadState, 1000);
        return () => clearInterval(interval);
    }, [workspaceName]);

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
                    overdue: "Overdue",
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

    const getStateDescription = (): string => {
        const parts: string[] = [];

        // Always include visibility status
        parts.push(state.isPublic ? "Public" : "Private");

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

        // If no filters or sorting, add default message
        if (!filterDesc && !sortDesc) {
            parts.push("Treat yourself to a cup of coffee and a good book. You deserve it.");
        }

        return parts.join(" • ");
    };

    return {
        state,
        hasActiveState: state.filters !== null || state.sort !== null,
        getStateDescription,
    };
};

