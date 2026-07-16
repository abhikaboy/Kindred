import { useDrag } from "@/components/calendar/DragContext";
import { TaskItem } from "@/components/TaskItem";
import { ThemedText } from "@/components/ThemedText";
import { cn } from "@/lib/utils";
import type { DailyBuckets } from "@/lib/dailyTasks";
import type { TaskDocument } from "@/hooks/useWorkspaces";

const SECTIONS: { key: keyof DailyBuckets; label: string }[] = [
  { key: "overdueTasks", label: "Overdue" },
  { key: "tasksForSelectedDate", label: "Today" },
  { key: "upcomingTasks", label: "Upcoming" },
];

function UnscheduledChips({ tasks }: { tasks: TaskDocument[] }) {
  const { startDrag, dragging } = useDrag();
  if (tasks.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <ThemedText type="subtitle">Unscheduled ({tasks.length})</ThemedText>
      <div className="flex flex-wrap gap-1.5">
        {tasks.map((t) => (
          <button
            key={t.id}
            onPointerDown={(e) => startDrag(t.id, e)}
            className={cn("cursor-grab touch-none rounded-full border bg-card/60 px-3 py-1.5", dragging?.taskId === t.id && "opacity-40")}
          >
            <ThemedText type="caption">{t.content || "Untitled task"}</ThemedText>
          </button>
        ))}
      </div>
    </div>
  );
}

export function AgendaPanel({ buckets }: { buckets: DailyBuckets }) {
  return (
    <aside className="flex w-72 shrink-0 flex-col gap-6 overflow-y-auto border-l border-border p-4">
      {SECTIONS.map((s) => {
        const tasks = buckets[s.key] as TaskDocument[];
        if (tasks.length === 0) return null;
        return (
          <div key={s.key} className="flex flex-col gap-2">
            <ThemedText type="subtitle">{s.label} ({tasks.length})</ThemedText>
            {tasks.map((t) => <TaskItem key={t.id} task={t} />)}
          </div>
        );
      })}
      <UnscheduledChips tasks={buckets.listUnscheduledTasks} />
    </aside>
  );
}
