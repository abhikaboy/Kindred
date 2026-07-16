import { addDays, isSameDay, isToday } from "date-fns";
import { HOUR_HEIGHT, layoutTimedTask, minutesToY, nowMinutes } from "@/lib/timeline";
import { CalendarEventCard } from "@/components/calendar/CalendarEventCard";
import { useDropTarget, useDragState } from "@/components/calendar/DragContext";
import { dayKey, type WeekDayTasks } from "@/lib/weekTasks";
import { ThemedText } from "@/components/ThemedText";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => `${((h + 11) % 12) + 1} ${h < 12 ? "AM" : "PM"}`;

function DayColumn({ day, tasks }: { day: Date; tasks: WeekDayTasks }) {
  const dropKey = `weekcol:${dayKey(day)}`;
  const ref = useDropTarget(dropKey);
  const { dragging, hoverKey } = useDragState();
  const hot = dragging && hoverKey === dropKey;
  return (
    <div
      ref={ref}
      data-weekcol={dayKey(day)}
      className={cn("relative flex-1 border-l border-border", hot && "bg-primary/5")}
      style={{ height: HOUR_HEIGHT * 24 }}
    >
      {HOURS.map((h) => (
        <div key={h} className="absolute inset-x-0 border-t border-border/60" style={{ top: minutesToY(h * 60) }} />
      ))}
      {isToday(day) && (
        <div className="absolute inset-x-0 z-10 border-t-2 border-destructive" style={{ top: minutesToY(nowMinutes()) }} />
      )}
      {tasks.timed.map((t) => {
        const { top, height } = layoutTimedTask(t, day);
        return <CalendarEventCard key={t.id} task={t} top={top} height={height} />;
      })}
    </div>
  );
}

type Props = {
  weekStart: Date;
  week: Record<string, WeekDayTasks>;
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
};

export function WeekGrid({ weekStart, week, selectedDate, onSelectDate }: Props) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Day headers */}
      <div className="flex border-b border-border pl-12">
        {days.map((day) => (
          <button
            key={day.toISOString()}
            onClick={() => onSelectDate(day)}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2",
              isSameDay(day, selectedDate) && "bg-primary/10"
            )}
          >
            <ThemedText type="caption" className={cn(!isToday(day) && "text-muted-foreground")}>
              {WEEKDAYS[day.getDay()]}
            </ThemedText>
            <ThemedText type="subtitle" className={cn(isToday(day) && "text-primary")}>
              {day.getDate()}
            </ThemedText>
          </button>
        ))}
      </div>
      {/* All-day row */}
      <div className="flex border-b border-border pl-12">
        {days.map((day) => (
          <div key={day.toISOString()} className="flex-1 border-l border-border p-1">
            {week[dayKey(day)].allDay.map((t) => (
              <div key={t.id} className="mb-0.5 truncate rounded bg-primary/10 px-1.5 py-0.5">
                <ThemedText type="caption" className="text-primary">{t.content || "Untitled"}</ThemedText>
              </div>
            ))}
          </div>
        ))}
      </div>
      {/* Scrollable timed grid */}
      <div className="relative flex min-h-0 flex-1 overflow-y-auto">
        <div className="relative w-12 shrink-0" style={{ height: HOUR_HEIGHT * 24 }}>
          {HOURS.map((h) => (
            <ThemedText
              key={h}
              type="caption"
              className="absolute right-1 text-muted-foreground"
              style={{ top: minutesToY(h * 60) - 6 }}
            >
              {hourLabel(h)}
            </ThemedText>
          ))}
        </div>
        <div className="flex flex-1">
          {days.map((day) => (
            <DayColumn key={day.toISOString()} day={day} tasks={week[dayKey(day)]} />
          ))}
        </div>
      </div>
    </div>
  );
}
