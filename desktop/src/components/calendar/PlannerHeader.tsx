import { CaretLeft, CaretRight, SidebarSimple } from "@phosphor-icons/react";
import { endOfWeek, format, isSameDay, isSameMonth, startOfWeek } from "date-fns";
import { ThemedText } from "@/components/ThemedText";
import { cn } from "@/lib/utils";
import { CalendarConnectionsDrawer } from "@/components/calendar/CalendarConnectionsDrawer";

export type ViewMode = "day" | "week" | "month";

// Mirrors mobile's planner title: "September 27", "September 27 – October 3" style
// ranges, "September"; the year only appears when it isn't the current one.
function plannerTitle(anchor: Date, mode: ViewMode): { title: string; year: number } {
  if (mode === "day") return { title: format(anchor, "MMMM d"), year: anchor.getFullYear() };
  if (mode === "month") return { title: format(anchor, "MMMM"), year: anchor.getFullYear() };
  const start = startOfWeek(anchor);
  const end = endOfWeek(anchor);
  const title = isSameMonth(start, end)
    ? `${format(start, "MMMM d")} – ${format(end, "d")}`
    : `${format(start, "MMM d")} – ${format(end, "MMM d")}`;
  return { title, year: start.getFullYear() };
}

function isTodayVisible(anchor: Date, mode: ViewMode): boolean {
  const now = new Date();
  if (mode === "day") return isSameDay(anchor, now);
  if (mode === "week") return isSameDay(startOfWeek(anchor), startOfWeek(now));
  return isSameMonth(anchor, now);
}

type Props = {
  anchorDate: Date;
  mode: ViewMode;
  onStep: (dir: -1 | 1) => void;
  onModeChange: (m: ViewMode) => void;
  onToday: () => void;
  showAgenda: boolean;
  onToggleAgenda: () => void;
};

export function PlannerHeader({ anchorDate, mode, onStep, onModeChange, onToday, showAgenda, onToggleAgenda }: Props) {
  const { title, year } = plannerTitle(anchorDate, mode);
  return (
    <div className="flex items-center justify-between gap-3 px-1 pb-3">
      <div className="flex items-center gap-2">
        <ThemedText type="titleFraunces" className="text-2xl">
          {title}
        </ThemedText>
        {year !== new Date().getFullYear() && (
          <ThemedText type="caption" className="self-end pb-1">
            {year}
          </ThemedText>
        )}
        <button aria-label={`Previous ${mode}`} onClick={() => onStep(-1)} className="rounded-md p-1 hover:bg-muted">
          <CaretLeft size={18} />
        </button>
        <button aria-label={`Next ${mode}`} onClick={() => onStep(1)} className="rounded-md p-1 hover:bg-muted">
          <CaretRight size={18} />
        </button>
        {!isTodayVisible(anchorDate, mode) && (
          <button onClick={onToday} className="rounded-full border px-3 py-1 text-sm hover:bg-muted">
            <ThemedText type="caption">Today</ThemedText>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {mode !== "month" && (
          <button
            aria-label={showAgenda ? "Hide agenda panel" : "Show agenda panel"}
            aria-pressed={showAgenda}
            onClick={onToggleAgenda}
            className={cn("rounded-md p-1.5 hover:bg-muted", showAgenda && "bg-primary/15 text-primary")}
          >
            <SidebarSimple size={18} />
          </button>
        )}
        <CalendarConnectionsDrawer />
        <div className="flex items-center rounded-full border p-0.5">
        {(["day", "week", "month"] as const).map((m) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className={cn(
              "rounded-full px-3 py-1 capitalize transition-colors",
              mode === m ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"
            )}
          >
            <ThemedText type="caption">{m}</ThemedText>
          </button>
        ))}
        </div>
      </div>
    </div>
  );
}
