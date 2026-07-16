import { useMemo, useState } from "react";
import { addMonths, addWeeks, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { PlannerHeader, type ViewMode } from "@/components/calendar/PlannerHeader";
import { WeekGrid } from "@/components/calendar/WeekGrid";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { AgendaPanel } from "@/components/calendar/AgendaPanel";
import { UnscheduledTray } from "@/components/calendar/UnscheduledTray";
import { DragProvider, useDragState } from "@/components/calendar/DragContext";
import { useCreate } from "@/components/create/CreateContext";
import { useDailyTasks } from "@/hooks/useDailyTasks";
import { useTaskCountsByDay, dayKey, fromDayKey } from "@/hooks/useTaskCountsByDay";
import { useAllTasks } from "@/hooks/useHomeTasks";
import { useUpdateTask, taskToUpdateDocument, AUTH_HEADER } from "@/hooks/useTaskActions";
import { tasksForWeek } from "@/lib/weekTasks";
import { yToMinutes } from "@/lib/timeline";
import type { TaskDocument } from "@/hooks/useWorkspaces";

function DragGhost() {
  const { dragging, pointer } = useDragState();
  if (!dragging || !pointer) return null;
  return (
    <div
      className="pointer-events-none fixed z-50 rounded-full bg-primary px-3 py-1.5 text-primary-foreground shadow-lg"
      style={{ left: pointer.x + 12, top: pointer.y + 12 }}
    >
      Scheduling…
    </div>
  );
}

function CalendarBody({ allTasks }: { allTasks: TaskDocument[] }) {
  const [mode, setMode] = useState<ViewMode>("week");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [monthAnchor, setMonthAnchor] = useState(() => new Date());

  const { openCreateTask } = useCreate();
  const onCreateRange = (day: Date, startMin: number, endMin: number) => {
    const start = new Date(day); start.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
    const end = new Date(day); end.setHours(Math.floor(endMin / 60), endMin % 60, 0, 0);
    openCreateTask({ startTime: start.toISOString(), startDate: start.toISOString(), deadline: end.toISOString() });
  };

  const weekStart = useMemo(() => startOfWeek(selectedDate), [selectedDate]);
  const week = useMemo(() => tasksForWeek(allTasks, weekStart), [allTasks, weekStart]);

  const range = useMemo(
    () =>
      mode === "week"
        ? { start: weekStart, end: endOfWeek(weekStart) }
        : { start: startOfWeek(startOfMonth(monthAnchor)), end: endOfWeek(endOfMonth(monthAnchor)) },
    [mode, weekStart, monthAnchor]
  );
  const density = useTaskCountsByDay(range.start, range.end);
  const buckets = useDailyTasks(selectedDate);

  const onStep = (dir: -1 | 1) => {
    if (mode === "week") setSelectedDate((d) => addWeeks(d, dir));
    else setMonthAnchor((d) => addMonths(d, dir));
  };
  const onToday = () => {
    const now = new Date();
    setSelectedDate(now);
    setMonthAnchor(now);
    setMode("week");
  };

  return (
    <div className="flex h-full flex-col p-4">
      <PlannerHeader
        anchorDate={mode === "week" ? selectedDate : monthAnchor}
        mode={mode}
        onStep={onStep}
        onModeChange={setMode}
        onToday={onToday}
      />
      <div className="flex min-h-0 flex-1 gap-4">
        {mode === "week" ? (
          <>
            <WeekGrid weekStart={weekStart} week={week} selectedDate={selectedDate} onSelectDate={setSelectedDate} onCreateRange={onCreateRange} />
            <AgendaPanel buckets={buckets} />
          </>
        ) : (
          <MonthGrid
            monthAnchor={monthAnchor}
            density={density}
            onSelectDay={(d) => {
              setSelectedDate(d);
              setMode("week");
            }}
            dropKeyFor={(d) => `day:${dayKey(d)}`}
          />
        )}
      </div>
      <UnscheduledTray tasks={buckets.listUnscheduledTasks} />
    </div>
  );
}

export function CalendarScreen() {
  const allTasks = useAllTasks();
  const updateTask = useUpdateTask();

  const handleDrop = (taskId: string, dropKey: string, point: { x: number; y: number }) => {
    if (dropKey.startsWith("weekcol:")) {
      const task = allTasks.find((t) => t.id === taskId);
      if (!task || !task.categoryID) return;
      const key = dropKey.slice("weekcol:".length);
      const colEl = document.querySelector<HTMLElement>(`[data-weekcol="${key}"]`);
      if (!colEl) return;
      const minutes = yToMinutes(point.y - colEl.getBoundingClientRect().top);
      const when = fromDayKey(key);
      when.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
      const iso = when.toISOString();
      updateTask.mutate({
        params: { header: AUTH_HEADER, path: { category: task.categoryID, id: task.id } },
        body: taskToUpdateDocument(task, { startTime: iso, startDate: iso }),
      });
      return;
    }
    if (!dropKey.startsWith("day:")) return;
    const task = allTasks.find((t) => t.id === taskId);
    if (!task || !task.categoryID) return;
    const day = fromDayKey(dropKey.slice(4));
    const deadline = new Date(day);
    deadline.setHours(17, 0, 0, 0); // default 5 pm, mirrors mobile quick-schedule
    updateTask.mutate({
      params: { header: AUTH_HEADER, path: { category: task.categoryID, id: task.id } },
      body: taskToUpdateDocument(task, { deadline: deadline.toISOString() }),
    });
  };

  return (
    <DragProvider onDrop={handleDrop}>
      <CalendarBody allTasks={allTasks} />
      <DragGhost />
    </DragProvider>
  );
}
