import { useQuery } from "@tanstack/react-query";
import { getCompletedTasksAPI, PaginatedCompletedTasksResponse } from "@/api/task";
import { useMemo } from "react";
import { Task } from "@/api/types";
import { startOfWeek } from "date-fns";

export function useCompletedThisWeek() {
    const { data, isLoading, refetch } = useQuery({
        queryKey: ["completedTasks", "thisWeek"],
        queryFn: () => getCompletedTasksAPI(1, 100),
    });

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
