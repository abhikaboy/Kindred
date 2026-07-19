import { useRef, useState } from "react";
import { format } from "date-fns";
import { DotsSixVertical } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { useTaskPeek } from "@/components/calendar/TaskPeekContext";
import { useDrag } from "@/components/calendar/DragContext";
import { minutesToY, resizeStart, resizeEnd, minuteToIsoOnDay } from "@/lib/timeline";
import { cn } from "@/lib/utils";
import type { TaskDocument } from "@/hooks/useWorkspaces";

type Props = {
  task: TaskDocument;
  top: number;
  height: number;
  leftPct: number;
  widthPct: number;
  onReschedule: (task: TaskDocument, patch: { startTime?: string; deadline?: string }) => void;
};

export function CalendarEventCard({ task, top, height, leftPct, widthPct, onReschedule }: Props) {
  const { openTask } = useTaskPeek();
  const { startDrag, dragging } = useDrag();
  const cardRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<{ top: number; height: number } | null>(null);

  // Body drag moves the block via the shared scheduler; a click (no drag) opens the peek.
  const onBodyPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const grabOffsetY = cardRef.current ? e.clientY - cardRef.current.getBoundingClientRect().top : 0;
    startDrag(task.id, e, {
      grabOffsetY,
      previewHeightPx: cardRef.current?.getBoundingClientRect().height,
      onClick: () => openTask(task),
    });
  };

  // Live edge-resize: preview locally, commit start (top) or deadline (bottom) on release.
  const onResize = (edge: "top" | "bottom") => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startY = e.clientY;
    const move = (ev: PointerEvent) => {
      const delta = ev.clientY - startY;
      if (edge === "top") {
        const t = minutesToY(resizeStart(top, height, delta));
        setPreview({ top: t, height: top + height - t });
      } else {
        setPreview({ top, height: minutesToY(resizeEnd(top, height, delta)) - top });
      }
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setPreview(null);
      if (!task.startTime) return;
      const delta = ev.clientY - startY;
      if (edge === "top") onReschedule(task, { startTime: minuteToIsoOnDay(task.startTime, resizeStart(top, height, delta)) });
      else onReschedule(task, { deadline: minuteToIsoOnDay(task.startTime, resizeEnd(top, height, delta)) });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const box = preview ?? { top, height };

  return (
    <div
      ref={cardRef}
      className={cn(
        "group absolute cursor-grab overflow-hidden rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 hover:bg-primary/20",
        dragging?.taskId === task.id && "opacity-40"
      )}
      style={{ top: box.top, height: box.height, left: `calc(${leftPct * 100}% + 2px)`, width: `calc(${widthPct * 100}% - 4px)` }}
      onPointerDown={onBodyPointerDown}
    >
      <div className="absolute inset-x-0 top-0 z-10 h-1.5 cursor-ns-resize" onPointerDown={onResize("top")} />
      <div className="flex h-full gap-1">
        <DotsSixVertical
          size={16}
          weight="bold"
          className="pointer-events-none mt-0.5 shrink-0 text-primary/40 transition-colors group-hover:text-primary/70"
        />
        <div className="min-w-0 flex-1">
          <ThemedText type="caption" className="text-primary">
            {task.startTime ? format(new Date(task.startTime), "h:mm a") : ""}
          </ThemedText>
          <ThemedText type="default" className="line-clamp-2 leading-5">
            {task.content || "Untitled task"}
          </ThemedText>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 z-10 h-1.5 cursor-ns-resize" onPointerDown={onResize("bottom")} />
    </div>
  );
}
