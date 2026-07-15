import { addDays, isSameDay, isToday } from "date-fns";
import { dayKey, type DayDensity } from "@/hooks/useTaskCountsByDay";
import { ThemedText } from "@/components/ThemedText";
import { useDropTarget, useDragState } from "@/components/calendar/DragContext";
import { cn } from "@/lib/utils";

type Props = {
  weekStart: Date;
  selectedDate: Date;
  density: Record<string, DayDensity>;
  onSelectDate: (d: Date) => void;
  dropKeyFor: (d: Date) => string;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function DayCell({
  day,
  selected,
  count,
  onSelect,
  dropKey,
}: {
  day: Date;
  selected: boolean;
  count: number;
  onSelect: () => void;
  dropKey: string;
}) {
  const ref = useDropTarget(dropKey);
  const { hoverKey, dragging } = useDragState();
  const hot = dragging && hoverKey === dropKey;
  return (
    <button
      ref={ref}
      onClick={onSelect}
      className={cn(
        "flex flex-col items-center gap-1 rounded-2xl border px-1 py-2 transition-colors",
        selected ? "border-primary bg-primary/10" : "border-border hover:bg-muted",
        hot && "border-primary bg-primary/20"
      )}
    >
      <ThemedText type="caption" className={cn(!selected && !hot && "text-muted-foreground")}>
        {WEEKDAYS[day.getDay()]}
      </ThemedText>
      <ThemedText type="default" className={cn(isToday(day) && !selected && "text-primary")}>
        {day.getDate()}
      </ThemedText>
      <span className={cn("h-1.5 w-1.5 rounded-full", count > 0 ? "bg-primary" : "bg-transparent")} />
    </button>
  );
}

export function WeekStrip({ weekStart, selectedDate, density, onSelectDate, dropKeyFor }: Props) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((day) => (
        <DayCell
          key={day.toISOString()}
          day={day}
          selected={isSameDay(day, selectedDate)}
          count={density[dayKey(day)]?.count ?? 0}
          onSelect={() => onSelectDate(day)}
          dropKey={dropKeyFor(day)}
        />
      ))}
    </div>
  );
}
