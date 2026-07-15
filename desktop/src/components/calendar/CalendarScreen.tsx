import { useMemo, useState } from "react";
import { addMonths, addWeeks, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { PlannerHeader, type ViewMode } from "@/components/calendar/PlannerHeader";
import { WeekStrip } from "@/components/calendar/WeekStrip";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { Agenda } from "@/components/calendar/Agenda";
import { useDailyTasks } from "@/hooks/useDailyTasks";
import { useTaskCountsByDay, dayKey } from "@/hooks/useTaskCountsByDay";

const dropKeyFor = (d: Date) => `day:${dayKey(d)}`;

export function CalendarScreen() {
  const [mode, setMode] = useState<ViewMode>("week");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [monthAnchor, setMonthAnchor] = useState(() => new Date());

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
          <Agenda selectedDate={selectedDate} buckets={buckets} />
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
    </div>
  );
}
