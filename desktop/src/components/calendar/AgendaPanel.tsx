import { useState } from "react";
import { format, isToday } from "date-fns";
import { DotsSixVertical, HandGrabbing, X } from "@phosphor-icons/react";
import { useDrag } from "@/components/calendar/DragContext";
import { useTaskPeek } from "@/components/calendar/TaskPeekContext";
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

const DRAG_HINT_KEY = "kindred.calendar.dragHintSeen";

// One-time, low-key tip: tasks can be dragged onto the grid to schedule.
function CalendarDragHint() {
  const [seen, setSeen] = useState(() => localStorage.getItem(DRAG_HINT_KEY) === "1");
  if (seen) return null;
  const dismiss = () => {
    localStorage.setItem(DRAG_HINT_KEY, "1");
    setSeen(true);
  };
  return (
    <div className="flex items-start gap-1.5 text-muted-foreground">
      <HandGrabbing size={14} className="mt-0.5 shrink-0" />
      <ThemedText type="caption" className="flex-1 text-muted-foreground">
        Drag a task onto any time to schedule or reschedule it.
      </ThemedText>
      <button onClick={dismiss} aria-label="Dismiss tip" className="shrink-0 opacity-50 transition-opacity hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  );
}

function UnscheduledChips({ tasks }: { tasks: TaskDocument[] }) {
  const { startDrag, dragging } = useDrag();
  const { openTask } = useTaskPeek();
  if (tasks.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <ThemedText type="subtitle">Unscheduled ({tasks.length})</ThemedText>
      <ThemedText type="caption" className="text-muted-foreground">Drag onto the calendar to schedule</ThemedText>
      <div className="flex flex-wrap gap-1.5">
        {tasks.map((t) => (
          <button
            key={t.id}
            onPointerDown={(e) => startDrag(t.id, e, { onClick: () => openTask(t) })}
            className={cn("cursor-grab touch-none rounded-full border bg-card/60 px-3 py-1.5", dragging?.taskId === t.id && "opacity-40")}
          >
            <ThemedText type="caption">{t.content || "Untitled task"}</ThemedText>
          </button>
        ))}
      </div>
    </div>
  );
}

export function AgendaPanel({ buckets, selectedDate }: { buckets: DailyBuckets; selectedDate: Date }) {
  const dayLabel = isToday(selectedDate) ? "Today" : format(selectedDate, "EEE, MMM d");
  const { openTask } = useTaskPeek();
  const { startDrag, dragging } = useDrag();
  return (
    <aside className="flex w-72 shrink-0 flex-col gap-6 overflow-y-auto border-l border-border p-4">
      <CalendarDragHint />
      {SECTIONS.map((s) => {
        const tasks = buckets[s.key] as TaskDocument[];
        if (tasks.length === 0) return null;
        const label = s.key === "tasksForSelectedDate" ? dayLabel : s.label;
        return (
          <div key={s.key} className="flex flex-col gap-2">
            <ThemedText type="subtitle">{label} ({tasks.length})</ThemedText>
            {tasks.map((t) => (
              <div
                key={t.id}
                onPointerDown={(e) => startDrag(t.id, e, { onClick: () => openTask(t) })}
                className={cn("group flex cursor-grab touch-none items-center gap-1", dragging?.taskId === t.id && "opacity-40")}
              >
                <DotsSixVertical
                  size={18}
                  weight="bold"
                  className="pointer-events-none shrink-0 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground"
                />
                <div className="min-w-0 flex-1">
                  <TaskItem task={t} />
                </div>
              </div>
            ))}
          </div>
        );
      })}
      <UnscheduledChips tasks={buckets.listUnscheduledTasks} />
    </aside>
  );
}
