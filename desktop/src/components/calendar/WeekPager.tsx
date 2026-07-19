import { useLayoutEffect, useRef } from "react";
import { addWeeks } from "date-fns";
import { WeekGrid } from "@/components/calendar/WeekGrid";
import { tasksForWeek, spanningTasksForWeek, spanningEdgesForWeek } from "@/lib/weekTasks";
import type { TaskDocument } from "@/hooks/useWorkspaces";

type Props = {
  allTasks: TaskDocument[];
  weekStart: Date;
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  onStepWeek: (dir: -1 | 1) => void;
  onCreateRange: (day: Date, startMin: number, endMin: number) => void;
  onReschedule: (task: TaskDocument, patch: { startTime?: string; deadline?: string }) => void;
};

// Notion-style week pager: prev/current/next weeks in a native scroll-snap track.
// The grid follows the horizontal swipe and snaps; on settle we step the week and
// instantly recenter to the middle page so the track stays "infinite".
export function WeekPager({ allTasks, weekStart, selectedDate, onSelectDate, onStepWeek, onCreateRange, onReschedule }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const settleRef = useRef<number | undefined>(undefined);
  const pages = [-1, 0, 1].map((off) => addWeeks(weekStart, off));

  // Center on the middle page before paint — on mount and after every week change.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.clientWidth;
  }, [weekStart]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    window.clearTimeout(settleRef.current);
    // ponytail: 140ms after the last scroll event ≈ snap settled; bump if a fast flick under-triggers.
    settleRef.current = window.setTimeout(() => {
      const idx = Math.round(el.scrollLeft / el.clientWidth); // 0 prev, 1 current, 2 next
      if (idx !== 1) onStepWeek(idx < 1 ? -1 : 1); // recenter handled by the layout effect
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
            week={tasksForWeek(allTasks, ws)}
            spanning={spanningTasksForWeek(allTasks, ws)}
            edges={spanningEdgesForWeek(allTasks, ws)}
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
