import { useEffect, useRef, useState } from "react";
import { addDays, format, isSameDay, isToday } from "date-fns";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { HOUR_HEIGHT, layoutDayEvents, minutesToY, nowMinutes, yToMinutes } from "@/lib/timeline";
import { CalendarEventCard } from "@/components/calendar/CalendarEventCard";
import { useDropTarget, useDragState } from "@/components/calendar/DragContext";
import { dayKey, type WeekDayTasks } from "@/lib/weekTasks";
import type { SpanningBar } from "@/lib/weekTasks";
import { ThemedText } from "@/components/ThemedText";
import { cn } from "@/lib/utils";
import type { TaskDocument } from "@/hooks/useWorkspaces";

type Reschedule = (task: TaskDocument, patch: { startTime?: string; deadline?: string }) => void;

const ROW_H = 22; // px per spanning-bar lane

function SpanningBars({ bars }: { bars: SpanningBar[] }) {
  if (bars.length === 0) return null;
  const maxRow = Math.max(...bars.map((b) => b.row));
  const regionH = (maxRow + 1) * ROW_H;
  return (
    <div className="relative" style={{ height: regionH }}>
      {bars.map((bar) => {
        const leftPct = (bar.startCol / 7) * 100;
        const widthPct = ((bar.endCol - bar.startCol + 1) / 7) * 100;
        return (
          <div
            key={bar.task.id}
            className={cn(
              "absolute flex items-center overflow-hidden bg-primary/10 px-1.5",
              bar.clippedLeft ? "rounded-l-none" : "rounded-l",
              bar.clippedRight ? "rounded-r-none" : "rounded-r"
            )}
            style={{
              left: `${leftPct}%`,
              width: `${widthPct}%`,
              top: bar.row * ROW_H,
              height: ROW_H - 2,
            }}
          >
            {bar.clippedLeft && <CaretLeft size={10} className="shrink-0 text-primary" />}
            <ThemedText type="caption" className="truncate text-primary">
              {bar.task.content || "Untitled"}
            </ThemedText>
            {bar.clippedRight && <CaretRight size={10} className="ml-auto shrink-0 text-primary" />}
          </div>
        );
      })}
    </div>
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => `${((h + 11) % 12) + 1} ${h < 12 ? "AM" : "PM"}`;
const minuteLabel = (min: number) => format(new Date(0, 0, 0, Math.floor(min / 60), min % 60), "h:mm a");

function DayColumn({ day, tasks, onCreateRange, onReschedule }: { day: Date; tasks: WeekDayTasks; onCreateRange: (day: Date, startMin: number, endMin: number) => void; onReschedule: Reschedule }) {
  const dropKey = `weekcol:${dayKey(day)}`;
  const ref = useDropTarget(dropKey);
  const { dragging, hoverKey, pointer, grabOffsetY, previewHeightPx } = useDragState();
  const hot = dragging && hoverKey === dropKey;

  const [draw, setDraw] = useState<{ start: number; end: number } | null>(null);
  const colRef = useRef<HTMLDivElement>(null);
  // Combine drop-target ref with local ref so both have access to the element
  const setCol = (el: HTMLDivElement | null) => { colRef.current = el; ref(el); };

  const onColPointerDown = (e: React.PointerEvent) => {
    if (dragging) return;
    const top = colRef.current!.getBoundingClientRect().top;
    const startMin = yToMinutes(e.clientY - top);
    setDraw({ start: startMin, end: startMin + 30 });
    const move = (ev: PointerEvent) => setDraw({ start: startMin, end: Math.max(startMin + 15, yToMinutes(ev.clientY - top)) });
    const up = (ev: PointerEvent) => {
      const endMin = Math.max(startMin + 15, yToMinutes(ev.clientY - top));
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDraw(null);
      onCreateRange(day, startMin, endMin);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Dashed preview at the slot a dragged task will land (same math as handleDrop).
  const previewStart =
    hot && pointer && colRef.current
      ? yToMinutes(pointer.y - colRef.current.getBoundingClientRect().top - grabOffsetY)
      : null;

  return (
    <div
      ref={setCol}
      data-weekcol={dayKey(day)}
      className={cn("relative flex-1 border-l border-border", hot && "bg-primary/5")}
      style={{ height: HOUR_HEIGHT * 24 }}
      onPointerDown={onColPointerDown}
    >
      {HOURS.map((h) => (
        <div key={h} className="absolute inset-x-0 border-t border-border/60" style={{ top: minutesToY(h * 60) }} />
      ))}
      {isToday(day) && (
        <div className="absolute inset-x-0 z-10 border-t-2 border-destructive" style={{ top: minutesToY(nowMinutes()) }} />
      )}
      {layoutDayEvents(tasks.timed, day).map((p) => (
        <CalendarEventCard key={p.task.id} task={p.task} top={p.top} height={p.height} leftPct={p.leftPct} widthPct={p.widthPct} onReschedule={onReschedule} />
      ))}
      {draw && (
        <div
          className="pointer-events-none absolute inset-x-1 z-20 rounded-lg border border-primary/50 bg-primary/20"
          style={{ top: minutesToY(draw.start), height: minutesToY(draw.end - draw.start) }}
        />
      )}
      {previewStart !== null && (
        <div
          className="pointer-events-none absolute inset-x-1 z-30 rounded-lg border-2 border-dashed border-primary bg-primary/5"
          style={{ top: minutesToY(previewStart), height: previewHeightPx }}
        >
          <ThemedText type="caption" className="text-primary px-1">
            {minuteLabel(previewStart)}
          </ThemedText>
        </div>
      )}
    </div>
  );
}

type Props = {
  weekStart: Date;
  week: Record<string, WeekDayTasks>;
  spanning: SpanningBar[];
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  onCreateRange: (day: Date, startMin: number, endMin: number) => void;
  onReschedule: Reschedule;
};

export function WeekGrid({ weekStart, week, spanning, selectedDate, onSelectDate, onCreateRange, onReschedule }: Props) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const scrollRef = useRef<HTMLDivElement>(null);
  // On mount, scroll so the current time sits near the top with a little context above.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = Math.max(0, minutesToY(nowMinutes()) - HOUR_HEIGHT * 2);
  }, []);
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
            <ThemedText type="caption" className={cn(!isToday(day) && !isSameDay(day, selectedDate) && "text-muted-foreground")}>
              {WEEKDAYS[day.getDay()]}
            </ThemedText>
            <ThemedText type="subtitle" className={cn(isToday(day) && "text-primary")}>
              {day.getDate()}
            </ThemedText>
          </button>
        ))}
      </div>
      {/* All-day row */}
      <div className="border-b border-border">
        {/* Spanning multi-day bars — positioned relative to the 7-column area */}
        <div className="pl-12">
          <SpanningBars bars={spanning} />
        </div>
        {/* Per-day all-day pills */}
        <div className="flex pl-12">
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
      </div>
      {/* Scrollable timed grid */}
      <div ref={scrollRef} className="relative flex min-h-0 flex-1 overflow-y-auto">
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
            <DayColumn key={day.toISOString()} day={day} tasks={week[dayKey(day)]} onCreateRange={onCreateRange} onReschedule={onReschedule} />
          ))}
        </div>
      </div>
    </div>
  );
}
