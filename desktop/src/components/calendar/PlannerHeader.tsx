import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { format } from "date-fns";
import { ThemedText } from "@/components/ThemedText";
import { cn } from "@/lib/utils";

export type ViewMode = "week" | "month";

type Props = {
  anchorDate: Date;
  mode: ViewMode;
  onStep: (dir: -1 | 1) => void;
  onModeChange: (m: ViewMode) => void;
  onToday: () => void;
};

export function PlannerHeader({ anchorDate, mode, onStep, onModeChange, onToday }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 px-1 pb-3">
      <div className="flex items-center gap-2">
        <ThemedText type="titleFraunces" className="text-2xl">
          {format(anchorDate, "MMMM yyyy")}
        </ThemedText>
        <button aria-label="Previous" onClick={() => onStep(-1)} className="rounded-md p-1 hover:bg-muted">
          <CaretLeft size={18} />
        </button>
        <button aria-label="Next" onClick={() => onStep(1)} className="rounded-md p-1 hover:bg-muted">
          <CaretRight size={18} />
        </button>
        <button onClick={onToday} className="rounded-full border px-3 py-1 text-sm hover:bg-muted">
          <ThemedText type="caption">Today</ThemedText>
        </button>
      </div>

      <div className="flex items-center rounded-full border p-0.5">
        {(["week", "month"] as const).map((m) => (
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
  );
}
