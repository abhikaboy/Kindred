import { useDrag } from "@/components/calendar/DragContext";
import { ThemedText } from "@/components/ThemedText";
import { cn } from "@/lib/utils";
import type { TaskDocument } from "@/hooks/useWorkspaces";

export function UnscheduledTray({ tasks }: { tasks: TaskDocument[] }) {
  const { startDrag, dragging } = useDrag();
  if (tasks.length === 0) return null;
  return (
    <div className="mt-3 flex flex-col gap-2 border-t pt-3">
      <ThemedText type="caption" className="text-muted-foreground">
        Unscheduled — drag onto a day
      </ThemedText>
      <div className="flex flex-wrap gap-2">
        {tasks.map((t) => (
          <button
            key={t.id}
            onPointerDown={(e) => startDrag(t.id, e)}
            className={cn(
              "cursor-grab touch-none rounded-full border bg-card/60 px-3 py-1.5",
              dragging?.taskId === t.id && "opacity-40"
            )}
          >
            <ThemedText type="caption">{t.content || "Untitled task"}</ThemedText>
          </button>
        ))}
      </div>
    </div>
  );
}
