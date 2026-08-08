import { useLayoutEffect, useRef } from "react";
import { addDays, addWeeks } from "date-fns";
import { WeekGrid } from "@/components/calendar/WeekGrid";
import { tasksForWeek, spanningTasksForWeek, spanningEdgesForWeek } from "@/lib/weekTasks";
import type { TaskDocument } from "@/hooks/useWorkspaces";

type Unit = "day" | "week";

type Props = {
  allTasks: TaskDocument[];
  unit: Unit;
  anchor: Date;
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  onStep: (dir: -1 | 1) => void;
  onCreateRange: (day: Date, startMin: number, endMin: number) => void;
  onReschedule: (task: TaskDocument, patch: { startTime?: string; deadline?: string }) => void;
};

// Notion-style pager: prev/current/next pages (a day or a week, per `unit`) in a
// native scroll-snap track. The grid follows the horizontal swipe and snaps; on
// settle we step and instantly recenter to the middle page so the track stays "infinite".
export function WeekPager({ allTasks, unit, anchor, selectedDate, onSelectDate, onStep, onCreateRange, onReschedule }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const settleRef = useRef<number | undefined>(undefined);
  const dayCount = unit === "day" ? 1 : 7;
  const step = unit === "day" ? addDays : addWeeks;
  const pages = [-1, 0, 1].map((off) => step(anchor, off));

  // Center on the middle page before paint — on mount and after every step.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.clientWidth;
  }, [anchor, unit]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    window.clearTimeout(settleRef.current);
    // ponytail: 140ms after the last scroll event ≈ snap settled; bump if a fast flick under-triggers.
    settleRef.current = window.setTimeout(() => {
      const idx = Math.round(el.scrollLeft / el.clientWidth); // 0 prev, 1 current, 2 next
      if (idx !== 1) onStep(idx < 1 ? -1 : 1); // recenter handled by the layout effect
    }, 140);
  };

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {pages.map((ws, i) => (
        <div key={i} className="flex h-full w-full shrink-0 snap-center flex-col">
          <WeekGrid
            weekStart={ws}
            dayCount={dayCount}
            week={tasksForWeek(allTasks, ws, dayCount)}
            spanning={spanningTasksForWeek(allTasks, ws, dayCount)}
            edges={spanningEdgesForWeek(allTasks, ws, dayCount)}
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
            onCreateRange={onCreateRange}
            onReschedule={onReschedule}
          />
        </div>
      ))}
    </div>
  );
}
