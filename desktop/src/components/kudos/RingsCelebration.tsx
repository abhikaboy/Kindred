import { Check } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";

const SIZE = 56;
const STROKE = 6;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

const RINGS = [
  { label: "Plan", color: "var(--chart-1)" },
  { label: "Do", color: "var(--chart-2)" },
  { label: "Share", color: "var(--chart-3)" },
] as const;

// Static "all rings closed" celebration for the rings-closed congrats modal.
// ponytail: not live data — it celebrates the recipient having closed all three.
export function RingsCelebration() {
  return (
    <div className="flex items-end justify-center gap-5 animate-in fade-in-0 zoom-in-95 duration-300">
      {RINGS.map((r) => (
        <div key={r.label} className="flex flex-col items-center gap-1.5">
          <div className="relative" style={{ width: SIZE, height: SIZE }}>
            <svg width={SIZE} height={SIZE} className="-rotate-90">
              <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" strokeWidth={STROKE} style={{ stroke: "var(--accent)" }} />
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={0}
                style={{ stroke: r.color }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <Check size={22} weight="bold" style={{ color: r.color }} />
            </div>
          </div>
          <ThemedText type="caption" className="text-[11px] uppercase tracking-widest">
            {r.label}
          </ThemedText>
        </div>
      ))}
    </div>
  );
}

export default RingsCelebration;
