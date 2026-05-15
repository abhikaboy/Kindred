import { useQuery } from "@tanstack/react-query";
import { getCompletedTasksAPI } from "@/api/task";
import { useMemo } from "react";
import { Task } from "@/api/types";

export function useCompletedThisWeek() {
    const { data, isLoading, refetch } = useQuery({
        queryKey: ["completedTasks", "thisWeek"],
        queryFn: () => getCompletedTasksAPI(1, 100),
    });

    const completedThisWeek = useMemo(() => {
        if (!data?.tasks) return [];
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        return data.tasks.filter((task: any) => {
            if (!task.timeCompleted) return false;
            return new Date(task.timeCompleted) >= sevenDaysAgo;
        }) as Task[];
    }, [data?.tasks]);

    return { completedThisWeek, isLoading, refetch };
}
