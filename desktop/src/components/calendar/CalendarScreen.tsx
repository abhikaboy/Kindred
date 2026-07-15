import { useMemo, useState } from "react";
import { addMonths, addWeeks, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { PlannerHeader, type ViewMode } from "@/components/calendar/PlannerHeader";
import { WeekStrip } from "@/components/calendar/WeekStrip";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { Agenda } from "@/components/calendar/Agenda";
import { DayTimeline } from "@/components/calendar/DayTimeline";
import { UnscheduledTray } from "@/components/calendar/UnscheduledTray";
import { DragProvider, useDragState } from "@/components/calendar/DragContext";
import { ThemedText } from "@/components/ThemedText";
import { useDailyTasks } from "@/hooks/useDailyTasks";
import { useTaskCountsByDay, dayKey, fromDayKey } from "@/hooks/useTaskCountsByDay";
import { useAllTasks } from "@/hooks/useHomeTasks";
import { useUpdateTask, taskToUpdateDocument, AUTH_HEADER } from "@/hooks/useTaskActions";

const dropKeyFor = (d: Date) => `day:${dayKey(d)}`;

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

function CalendarBody() {
  const [mode, setMode] = useState<ViewMode>("week");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [monthAnchor, setMonthAnchor] = useState(() => new Date());
  const [dayDetail, setDayDetail] = useState<"agenda" | "timeline">("agenda");

  const weekStart = useMemo(() => startOfWeek(selectedDate), [selectedDate]);
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
      {mode === "week" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <WeekStrip
            weekStart={weekStart}
            selectedDate={selectedDate}
            density={density}
            onSelectDate={setSelectedDate}
            dropKeyFor={dropKeyFor}
          />
          <div className="flex items-center justify-end">
            <button
              onClick={() => setDayDetail((v) => (v === "agenda" ? "timeline" : "agenda"))}
              className="rounded-full border px-3 py-1 hover:bg-muted"
            >
              <ThemedText type="caption">{dayDetail === "agenda" ? "Timeline" : "Agenda"}</ThemedText>
            </button>
          </div>
          {dayDetail === "agenda" ? (
            <Agenda selectedDate={selectedDate} buckets={buckets} />
          ) : (
            <DayTimeline selectedDate={selectedDate} timedTasks={buckets.tasksWithSpecificTime} />
          )}
        </div>
      ) : (
        <MonthGrid
          monthAnchor={monthAnchor}
          density={density}
          onSelectDay={(d) => {
            setSelectedDate(d);
            setMode("week");
          }}
          dropKeyFor={dropKeyFor}
        />
      )}
      <UnscheduledTray tasks={buckets.listUnscheduledTasks} />
    </div>
  );
}

export function CalendarScreen() {
  const allTasks = useAllTasks();
  const updateTask = useUpdateTask();

  const handleDrop = (taskId: string, dropKey: string) => {
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
      <CalendarBody />
      <DragGhost />
    </DragProvider>
  );
}
