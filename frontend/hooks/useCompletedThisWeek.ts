import { useQuery } from "@tanstack/react-query";
import { getCompletedTasksAPI } from "@/api/task";
import { useMemo } from "react";
import { Task } from "@/api/types";
import { startOfWeek } from "date-fns";

// Server returns completed tasks newest-first, so one page of 100 also covers
// any smaller "most recent N" view — share it instead of fetching twice.
export const COMPLETED_TASKS_KEY = ["completedTasks", "recent", 100] as const;

export function useRecentCompletedTasks() {
    return useQuery({
        queryKey: COMPLETED_TASKS_KEY,
        queryFn: () => getCompletedTasksAPI(1, 100),
    });
}

export function useCompletedThisWeek() {
    const { data, isLoading, refetch } = useRecentCompletedTasks();

    const completedThisWeek = useMemo(() => {
        if (!data?.tasks) return [];
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

        return data.tasks.filter((task) => {
            if (!task.timeCompleted) return false;
            return new Date(task.timeCompleted) >= weekStart;
        }) as Task[];
    }, [data?.tasks]);

    return { completedThisWeek, isLoading, refetch };
}
