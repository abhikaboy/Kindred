import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { isToday, isThisWeek, isFuture, isPast } from "date-fns";
import { Task } from "@/api/types";

export type FilterState = {
    priorities: { low: boolean; medium: boolean; high: boolean };
    deadlines: { overdue: boolean; today: boolean; thisWeek: boolean; future: boolean; none: boolean };
};

export const useWorkspaceFilters = (workspaceName: string) => {
    const [filters, setFilters] = useState<FilterState | null>(null);

    useEffect(() => {
        const loadFilters = async () => {
            try {
                const saved = await AsyncStorage.getItem(`workspace-filters-${workspaceName}`);
                if (saved) {
                    setFilters(JSON.parse(saved));
                } else {
                    setFilters(null);
                }
            } catch (error) {
                console.error("Error loading filters:", error);
                setFilters(null);
            }
        };
        loadFilters();

        // Listen for storage changes (when filters are updated)
        const interval = setInterval(loadFilters, 1000);
        return () => clearInterval(interval);
    }, [workspaceName]);

    const applyFilters = (tasks: Task[]): Task[] => {
        if (!filters) return tasks;

        // Check if any filters are active
        const hasPriorityFilters = Object.values(filters.priorities).some(v => v);
        const hasDeadlineFilters = Object.values(filters.deadlines).some(v => v);

        if (!hasPriorityFilters && !hasDeadlineFilters) {
            return tasks;
        }

        return tasks.filter((task) => {
            let matchesPriority = !hasPriorityFilters; // If no priority filters, pass all
            let matchesDeadline = !hasDeadlineFilters; // If no deadline filters, pass all

            // Check priority filters
            if (hasPriorityFilters) {
                // Priority is stored as a number: 1 = low, 2 = medium, 3 = high
                const taskPriority = task.priority;
                if (
                    (filters.priorities.low && taskPriority === 1) ||
                    (filters.priorities.medium && taskPriority === 2) ||
                    (filters.priorities.high && taskPriority === 3)
                ) {
                    matchesPriority = true;
                }
            }

            // Check deadline filters
            if (hasDeadlineFilters) {
                if (filters.deadlines.none && !task.deadline) {
                    matchesDeadline = true;
                } else if (task.deadline) {
                    const deadlineDate = new Date(task.deadline);
                    const now = new Date();

                    if (filters.deadlines.overdue && isPast(deadlineDate) && !isToday(deadlineDate)) {
                        matchesDeadline = true;
                    }
                    if (filters.deadlines.today && isToday(deadlineDate)) {
                        matchesDeadline = true;
                    }
                    if (filters.deadlines.thisWeek && isThisWeek(deadlineDate, { weekStartsOn: 0 })) {
                        matchesDeadline = true;
                    }
                    if (filters.deadlines.future && isFuture(deadlineDate) && !isToday(deadlineDate) && !isThisWeek(deadlineDate, { weekStartsOn: 0 })) {
                        matchesDeadline = true;
                    }
                }
            }

            return matchesPriority && matchesDeadline;
        });
    };

    return { filters, applyFilters };
};

