import { TaskItem } from "@/components/TaskItem";
import { SwipeToComplete } from "@/components/SwipeToComplete";
import { ThemedText } from "@/components/ThemedText";
import { useWorkingOnTasks } from "@/hooks/useHomeTasks";

const MAX = 5;

// In-progress tasks (durable `active` or a live focus session). Tile content.
export function WorkingOnRow() {
  const tasks = useWorkingOnTasks();

  if (tasks.length === 0) {
    return (
      <ThemedText type="caption" className="text-muted-foreground">
        Nothing in progress right now
      </ThemedText>
    );
  }

  const shown = tasks.slice(0, MAX);
  const extra = tasks.length - shown.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((task) => (
          <SwipeToComplete key={task.id} task={task} categoryId={task.categoryID ?? ""}>
            <TaskItem task={task} />
          </SwipeToComplete>
        ))}
      </div>
      {extra > 0 && (
        <ThemedText type="caption" className="text-muted-foreground">
          +{extra} more in progress
        </ThemedText>
      )}
    </div>
  );
}

export default WorkingOnRow;
