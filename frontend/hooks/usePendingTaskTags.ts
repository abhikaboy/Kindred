import { useQuery } from "@tanstack/react-query";
import { getPendingTaggedTasksAPI } from "@/api/task";

export const PENDING_TAGS_KEY = ["taskTags", "pending"] as const;

export const usePendingTaskTags = () => {
    return useQuery({
        queryKey: PENDING_TAGS_KEY,
        queryFn: getPendingTaggedTasksAPI,
        staleTime: 60_000,
    });
};
