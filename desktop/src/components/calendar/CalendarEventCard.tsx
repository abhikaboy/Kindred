import { format } from "date-fns";
import { ThemedText } from "@/components/ThemedText";
import { useTaskPeek } from "@/components/calendar/TaskPeekContext";
import type { TaskDocument } from "@/hooks/useWorkspaces";

type Props = { task: TaskDocument; top: number; height: number };

export function CalendarEventCard({ task, top, height }: Props) {
  const { openTask } = useTaskPeek();
  return (
    <div
      className="absolute inset-x-1 cursor-pointer overflow-hidden rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 hover:bg-primary/20"
      style={{ top, height }}
      // Stop the column's draw-to-create gesture from firing when clicking a card.
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => openTask(task)}
    >
      <ThemedText type="caption" className="text-primary">
        {task.startTime ? format(new Date(task.startTime), "h:mm a") : ""}
      </ThemedText>
      <ThemedText type="default" className="line-clamp-2 leading-5">
        {task.content || "Untitled task"}
      </ThemedText>
    </div>
  );
}
