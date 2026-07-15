import { addDays, isSameDay, isToday } from "date-fns";
import { dayKey, type DayDensity } from "@/hooks/useTaskCountsByDay";
import { ThemedText } from "@/components/ThemedText";
import { cn } from "@/lib/utils";

type Props = {
  weekStart: Date;
  selectedDate: Date;
  density: Record<string, DayDensity>;
  onSelectDate: (d: Date) => void;
  dropKeyFor: (d: Date) => string;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function WeekStrip({ weekStart, selectedDate, density, onSelectDate, dropKeyFor }: Props) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((day) => {
        const selected = isSameDay(day, selectedDate);
        const count = density[dayKey(day)]?.count ?? 0;
        return (
          <button
            key={day.toISOString()}
            data-drop-key={dropKeyFor(day)}
            onClick={() => onSelectDate(day)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-2xl border px-1 py-2 transition-colors",
              selected ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
            )}
          >
            <ThemedText type="caption" className="text-muted-foreground">
              {WEEKDAYS[day.getDay()]}
            </ThemedText>
            <ThemedText type="default" className={cn(isToday(day) && !selected && "text-primary")}>
              {day.getDate()}
            </ThemedText>
            <span className={cn("h-1.5 w-1.5 rounded-full", count > 0 ? "bg-primary" : "bg-transparent")} />
          </button>
        );
      })}
    </div>
  );
}
