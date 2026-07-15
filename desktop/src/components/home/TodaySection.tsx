import { TaskItem } from "@/components/TaskItem";
import { SwipeToComplete } from "@/components/SwipeToComplete";
import { ThemedText } from "@/components/ThemedText";
import { Skeleton } from "@/components/ui/skeleton";
import { useTodayTasks } from "@/hooks/useHomeTasks";
import { useWorkspaces } from "@/hooks/useWorkspaces";

// Today's upcoming tasks (deadline or start time falls today), capped. Tile content.
export function TodaySection() {
  const { isLoading } = useWorkspaces();
  const tasks = useTodayTasks();
  const shown = tasks.slice(0, 6);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    );
  }

  if (shown.length === 0) {
    return (
      <ThemedText type="caption" className="text-muted-foreground">
        Nothing due today
      </ThemedText>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {shown.map((task) => (
        <SwipeToComplete key={task.id} task={task} categoryId={task.categoryID ?? ""}>
          <TaskItem task={task} />
        </SwipeToComplete>
      ))}
    </div>
  );
}

export default TodaySection;
