import { eachDayOfInterval, endOfMonth, endOfWeek, isSameMonth, isToday, startOfMonth, startOfWeek } from "date-fns";
import { dayKey, type DayDensity } from "@/hooks/useTaskCountsByDay";
import { ThemedText } from "@/components/ThemedText";
import { useDropTarget, useDragState } from "@/components/calendar/DragContext";
import { cn } from "@/lib/utils";

type Props = {
  monthAnchor: Date;
  density: Record<string, DayDensity>;
  onSelectDay: (d: Date) => void;
  dropKeyFor: (d: Date) => string;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function MonthCell({
  day,
  inMonth,
  densityCount,
  onSelect,
  dropKey,
}: {
  day: Date;
  inMonth: boolean;
  densityCount: number;
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
        "flex min-h-20 flex-col items-start gap-1 rounded-xl border p-1.5 text-left transition-colors hover:bg-muted",
        inMonth ? "border-border" : "border-transparent opacity-40",
        hot && "border-primary bg-primary/20"
      )}
    >
      <ThemedText type="caption" className={cn(isToday(day) && "text-primary")}>
        {day.getDate()}
      </ThemedText>
      {densityCount > 0 && (
        <span className="rounded-full bg-primary/10 px-1.5 py-0.5">
          <ThemedText type="caption" className="text-primary">
            {densityCount}
          </ThemedText>
        </span>
      )}
    </button>
  );
}

export function MonthGrid({ monthAnchor, density, onSelectDay, dropKeyFor }: Props) {
  const gridStart = startOfWeek(startOfMonth(monthAnchor));
  const gridEnd = endOfWeek(endOfMonth(monthAnchor));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className="flex flex-1 flex-col">
      <div className="grid grid-cols-7">
        {WEEKDAYS.map((w) => (
          <ThemedText key={w} type="caption" className="px-2 py-1 text-muted-foreground">
            {w}
          </ThemedText>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7 gap-1">
        {days.map((day) => (
          <MonthCell
            key={day.toISOString()}
            day={day}
            inMonth={isSameMonth(day, monthAnchor)}
            densityCount={density[dayKey(day)]?.count ?? 0}
            onSelect={() => onSelectDay(day)}
            dropKey={dropKeyFor(day)}
          />
        ))}
      </div>
    </div>
  );
}
