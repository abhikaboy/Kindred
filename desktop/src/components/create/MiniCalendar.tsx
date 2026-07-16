import { useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const dayKey = (d: Date) => d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate();
const sameDay = (a: Date, b: Date) => dayKey(a) === dayKey(b);

// 42-cell grid (6 weeks) starting on the Sunday on/before the 1st.
function monthGrid(view: Date): Date[] {
  const first = startOfMonth(view);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

// Range-aware month picker: highlights start/end endpoints + the days between.
export function MiniCalendar({
  start,
  end,
  onPick,
}: {
  start: Date | null;
  end: Date | null;
  onPick: (day: Date) => void;
}) {
  const [view, setView] = useState(() => startOfMonth(start ?? end ?? new Date()));
  const today = new Date();
  const cells = monthGrid(view);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1))}
          className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted"
          aria-label="Previous month"
        >
          <CaretLeft size={14} />
        </button>
        <span className="text-sm font-medium">
          {view.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </span>
        <button
          type="button"
          onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))}
          className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted"
          aria-label="Next month"
        >
          <CaretRight size={14} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="grid h-6 place-items-center text-xs text-muted-foreground">
            {w}
          </div>
        ))}
        {cells.map((day) => {
          const inMonth = day.getMonth() === view.getMonth();
          const isStart = start && sameDay(day, start);
          const isEnd = end && sameDay(day, end);
          const between = start && end && dayKey(day) > dayKey(start) && dayKey(day) < dayKey(end);
          const endpoint = isStart || isEnd;
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onPick(day)}
              className={cn(
                "grid aspect-square place-items-center text-sm transition-colors",
                between && "bg-primary/15",
                isStart && "rounded-l-md",
                isEnd && "rounded-r-md",
                endpoint
                  ? "rounded-md bg-primary text-primary-foreground"
                  : cn(
                      "rounded-md",
                      !inMonth && "text-muted-foreground/40",
                      !between && "hover:bg-muted",
                      sameDay(day, today) && !between && "text-primary font-medium",
                    ),
              )}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
