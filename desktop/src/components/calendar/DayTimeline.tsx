import { useRef } from "react";
import { isToday } from "date-fns";
import { HOUR_HEIGHT, layoutTimedTask, minutesToY, nowMinutes, yToMinutes } from "@/lib/timeline";
import { useDropTarget, useDragState } from "@/components/calendar/DragContext";
import { dayKey } from "@/hooks/useTaskCountsByDay";
import { CalendarEventCard } from "@/components/calendar/CalendarEventCard";
import { ThemedText } from "@/components/ThemedText";
import type { TaskDocument } from "@/hooks/useWorkspaces";

type Props = { selectedDate: Date; timedTasks: TaskDocument[] };

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => `${((h + 11) % 12) + 1} ${h < 12 ? "AM" : "PM"}`;

export function DayTimeline({ selectedDate, timedTasks }: Props) {
  const timelineKey = `timeline:${dayKey(selectedDate)}`;
  const dropRef = useDropTarget(timelineKey);
  const { dragging, hoverKey, pointer } = useDragState();
  const gridRef = useRef<HTMLDivElement>(null);

  // Combine the drop-target ref and our local grid ref in one callback.
  const setGrid = (el: HTMLDivElement | null) => {
    gridRef.current = el;
    dropRef(el);
  };

  // Ghost line tracks pointer while hovering the timeline grid.
  const ghostTop =
    dragging && hoverKey === timelineKey && pointer && gridRef.current
      ? minutesToY(yToMinutes(pointer.y - gridRef.current.getBoundingClientRect().top))
      : null;

  return (
    <div className="relative flex-1 overflow-y-auto">
      <div ref={setGrid} data-timeline-grid="true" className="relative" style={{ height: HOUR_HEIGHT * 24 }}>
        {HOURS.map((h) => (
          <div key={h} className="absolute left-0 right-0 border-t border-border" style={{ top: minutesToY(h * 60) }}>
            <ThemedText type="caption" className="absolute -top-2 left-0 w-12 text-right text-muted-foreground">
              {hourLabel(h)}
            </ThemedText>
          </div>
        ))}
        {isToday(selectedDate) && (
          <div className="absolute left-12 right-0 z-10 border-t-2 border-destructive" style={{ top: minutesToY(nowMinutes()) }} />
        )}
        {ghostTop !== null && (
          <div
            className="pointer-events-none absolute left-12 right-2 z-20 border-t-2 border-dashed border-primary"
            style={{ top: ghostTop }}
          />
        )}
        {timedTasks.map((t) => {
          const { top, height } = layoutTimedTask(t, selectedDate);
          return <CalendarEventCard key={t.id} task={t} top={top} height={height} />;
        })}
      </div>
    </div>
  );
}
