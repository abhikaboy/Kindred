import { $api } from "@/lib/api/query";
import { ThemedText } from "@/components/ThemedText";
import { TaskItem } from "@/components/TaskItem";
import { Skeleton } from "@/components/ui/skeleton";

// Accomplished-recently list — renders each completed task with the same TaskItem
// card used elsewhere, mirroring mobile (which shows accomplished tasks as TaskCards).
export function ProfileTasks() {
    const { data, isLoading, error } = $api.useQuery("get", "/v1/user/tasks/completed", {
        params: { header: { Authorization: "" }, query: { page: 1, limit: 12 } },
    });

    const tasks = data?.tasks ?? [];

    return (
        <div className="flex flex-col gap-3">
            <ThemedText type="subtitle" as="h3">
                Accomplished Recently
            </ThemedText>

            {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-2xl" />
                ))
            ) : error ? (
                <ThemedText type="caption" className="text-muted-foreground">
                    Couldn’t load completed tasks.
                </ThemedText>
            ) : tasks.length === 0 ? (
                <ThemedText type="caption" className="text-muted-foreground">
                    No completed tasks yet.
                </ThemedText>
            ) : (
                tasks.map((task) => <TaskItem key={task.id} task={task} completed />)
            )}
        </div>
    );
}
