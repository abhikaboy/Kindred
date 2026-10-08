import { useState } from "react";
import { Check } from "@phosphor-icons/react";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThemedText } from "@/components/ThemedText";
import { ConcentricRings } from "@/components/rings/ConcentricRings";
import { RingDetail } from "@/components/rings/RingDetail";
import { ScoreInfoDialog } from "@/components/rings/ScoreInfoDialog";
import { usePausedToday } from "@/components/rings/LifeHappened";
import { useRingsToday } from "@/hooks/useRings";
import { RING_COLORS, type RingKey } from "@shared/rings";
import { cn } from "@/lib/utils";

const RINGS: { key: RingKey; label: string }[] = [
  { key: "plan", label: "Plan" },
  { key: "do", label: "Do" },
  { key: "share", label: "Share" },
];

const SCORE_HINT_KEY = "kindred.hint.productivityScore";

// Explains the score once on first view, like mobile's first-touch hint.
function useScoreInfo() {
  const [open, setOpen] = useState(() => localStorage.getItem(SCORE_HINT_KEY) == null);
  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) localStorage.setItem(SCORE_HINT_KEY, "1");
  };
  return { open, onOpenChange };
}

// Matches the mobile home card: one concentric set with the score in the center
// and a legend beside it. A legend row opens that ring's detail and isolates it.
export function ProductivityRings(): React.JSX.Element {
  const { data, isLoading } = useRingsToday();
  const [hovered, setHovered] = useState<RingKey | null>(null);
  const [expanded, setExpanded] = useState<RingKey | null>(null);
  const scoreInfo = useScoreInfo();
  const paused = usePausedToday();

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-6">
        <Skeleton className="size-[132px] rounded-full" />
        <div className="flex w-40 flex-col gap-3">
          {RINGS.map((r) => (
            <Skeleton key={r.key} className="h-5 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const rings = data.ring_state;
  const focused = expanded ?? hovered;
  // A paused day holds everything in place; recede rather than ask for anything.
  return (
    <div className={cn("flex items-center gap-6 transition-opacity", paused && "opacity-50")}>
      <ConcentricRings
        rings={rings}
        dimmedExcept={focused}
        center={
          <button
            type="button"
            onClick={() => scoreInfo.onOpenChange(true)}
            aria-label={`Productivity score ${data.productivity_score}. How it works`}
            className="rounded-full px-2 transition-opacity hover:opacity-70"
          >
            <ThemedText type="subtitle" className="tabular-nums">
              {data.productivity_score}
            </ThemedText>
          </button>
        }
      />
      <div className="flex w-40 flex-col gap-3" onMouseLeave={() => setHovered(null)}>
        {RINGS.map(({ key, label }) => {
          const progress = rings[key];
          return (
            <Popover key={key} open={expanded === key} onOpenChange={(open) => setExpanded(open ? key : null)}>
              <PopoverTrigger
                onMouseEnter={() => setHovered(key)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md py-1 text-left transition-opacity",
                  focused && focused !== key && "opacity-30"
                )}
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: RING_COLORS[key] }} />
                <ThemedText type="default" className="flex-1">
                  {label}
                </ThemedText>
                {progress.closed ? (
                  <Check size={16} weight="bold" style={{ color: RING_COLORS[key] }} />
                ) : (
                  <span className="font-sans text-sm font-semibold tabular-nums">
                    {progress.current}/{progress.target}
                  </span>
                )}
              </PopoverTrigger>
              <PopoverContent side="right" align="start" sideOffset={16} className="w-80 p-4">
                <RingDetail ringKey={key} today={progress} onNavigate={() => setExpanded(null)} />
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
      <ScoreInfoDialog score={data.productivity_score} open={scoreInfo.open} onOpenChange={scoreInfo.onOpenChange} />
    </div>
  );
}
