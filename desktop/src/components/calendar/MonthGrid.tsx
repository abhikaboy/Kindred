import { eachDayOfInterval, endOfMonth, endOfWeek, isSameMonth, isToday, startOfMonth, startOfWeek } from "date-fns";
import { dayKey, type DayDensity } from "@/hooks/useTaskCountsByDay";
import { ThemedText } from "@/components/ThemedText";
import { cn } from "@/lib/utils";

type Props = {
  monthAnchor: Date;
  density: Record<string, DayDensity>;
  onSelectDay: (d: Date) => void;
  dropKeyFor: (d: Date) => string;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
        {days.map((day) => {
          const density_ = density[dayKey(day)];
          const inMonth = isSameMonth(day, monthAnchor);
          return (
            <button
              key={day.toISOString()}
              data-drop-key={dropKeyFor(day)}
              onClick={() => onSelectDay(day)}
              className={cn(
                "flex min-h-20 flex-col items-start gap-1 rounded-xl border p-1.5 text-left transition-colors hover:bg-muted",
                inMonth ? "border-border" : "border-transparent opacity-40"
              )}
            >
              <ThemedText type="caption" className={cn(isToday(day) && "font-semibold text-primary")}>
                {day.getDate()}
              </ThemedText>
              {density_ && density_.count > 0 && (
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5">
                  <ThemedText type="caption" className="text-primary">
                    {density_.count}
                  </ThemedText>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
