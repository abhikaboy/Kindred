import { useEffect, useState } from "react";
import { Check } from "@phosphor-icons/react";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemedText } from "@/components/ThemedText";
import { useRingsToday, type RingProgress } from "@/hooks/useRings";

// Matches mobile: three separate rings, primary-purple fill on a neutral track.
const SIZE = 80;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

const RINGS = [
  { key: "plan", label: "Plan" },
  { key: "do", label: "Do" },
  { key: "share", label: "Share" },
] as const;

function fraction(p: RingProgress): number {
  if (!p.target || p.target <= 0) return 0;
  return Math.min(Math.max(p.current / p.target, 0), 1);
}

function Ring({ label, progress }: { label: string; progress: RingProgress }) {
  const target = fraction(progress);
  const [fill, setFill] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFill(target));
    return () => cancelAnimationFrame(id);
  }, [target]);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="-rotate-90">
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            style={{ stroke: "var(--accent)" }}
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - fill)}
            style={{ stroke: "var(--primary)", transition: "stroke-dashoffset 800ms ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {progress.closed ? (
            <Check size={24} weight="bold" className="text-primary" />
          ) : (
            <ThemedText type="defaultSemiBold" className="text-sm">
              {progress.current}/{progress.target}
            </ThemedText>
          )}
        </div>
      </div>
      <ThemedText type="caption" className="uppercase tracking-widest">
        {label}
      </ThemedText>
    </div>
  );
}

export function ProductivityRings(): React.JSX.Element {
  const { data, isLoading } = useRingsToday();

  if (isLoading || !data) {
    return (
      <div className="flex items-start gap-8">
        {RINGS.map((r) => (
          <div key={r.key} className="flex flex-col items-center gap-1.5">
            <Skeleton className="size-20 rounded-full" />
            <Skeleton className="h-3 w-10" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-8">
      {RINGS.map((r) => (
        <Ring key={r.key} label={r.label} progress={data.ring_state[r.key]} />
      ))}
    </div>
  );
}
