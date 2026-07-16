import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { ThemedText } from "@/components/ThemedText";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspaces, type TaskDocument } from "@/hooks/useWorkspaces";
import { TaskEditor, BackLink } from "@/components/task/TaskEditor";

// Resolve a task and its parent category id from the cached workspace tree.
function findTask(
  data: ReturnType<typeof useWorkspaces>["data"],
  id: string | undefined
): { task: TaskDocument; categoryId: string } | undefined {
  if (!data || !id) return undefined;
  for (const ws of data) {
    for (const category of ws.categories ?? []) {
      const task = category.tasks?.find((t) => t.id === id);
      if (task) return { task, categoryId: category.id };
    }
  }
  return undefined;
}

export default function TaskDetailScreen() {
  const { id } = useParams();
  const { data, isLoading } = useWorkspaces();
  const found = useMemo(() => findTask(data, id), [data, id]);

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6 pt-6">
        <Skeleton className="h-5 w-10 rounded-md" />
        <Skeleton className="h-9 w-2/3 rounded-lg" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (!found) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4 pt-6">
        <BackLink />
        <ThemedText type="title" as="h1">
          Task not found
        </ThemedText>
        <ThemedText type="lightBody" className="text-muted-foreground">
          This task may have been completed or deleted.
        </ThemedText>
      </div>
    );
  }

  return <TaskEditor key={found.task.id} task={found.task} categoryId={found.categoryId} />;
}
