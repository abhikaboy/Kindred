import { useMemo } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import { $api } from "@/lib/api/query";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { ThemedText } from "@/components/ThemedText";
import { Skeleton } from "@/components/ui/skeleton";

export function ProfileTasks() {
    const { data, isLoading, error } = $api.useQuery("get", "/v1/user/tasks/completed", {
        params: { header: { Authorization: "" }, query: { page: 1, limit: 12 } },
    });

    // categoryID is an ObjectID; resolve to a name via the workspace tree.
    const { data: workspaces } = useWorkspaces();
    const categoryNames = useMemo(() => {
        const map = new Map<string, string>();
        workspaces?.forEach((ws) => ws.categories?.forEach((c) => c.id && map.set(c.id, c.name)));
        return map;
    }, [workspaces]);

    if (isLoading) {
        return (
            <div className="flex flex-col gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
            </div>
        );
    }

    if (error) {
        return <ThemedText type="caption">Couldn’t load completed tasks.</ThemedText>;
    }

    const tasks = data?.tasks ?? [];
    if (tasks.length === 0) {
        return <ThemedText type="caption">No completed tasks yet.</ThemedText>;
    }

    return (
        <div className="flex flex-col">
            <ThemedText type="subtitle" as="h3" className="mb-2">
                Accomplished Recently
            </ThemedText>
            {tasks.map((task) => (
                <div
                    key={task.id}
                    className="flex items-center gap-3 border-b border-border py-3 last:border-b-0"
                >
                    <CheckCircle weight="fill" className="size-5 shrink-0 text-primary" />
                    <ThemedText className="flex-1 truncate">{task.content}</ThemedText>
                    {task.categoryID && categoryNames.get(task.categoryID) && (
                        <ThemedText type="caption">{categoryNames.get(task.categoryID)}</ThemedText>
                    )}
                    {task.value > 0 && (
                        <span className="rounded-full bg-secondary px-2 py-0.5">
                            <ThemedText type="caption">+{task.value}</ThemedText>
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
}
