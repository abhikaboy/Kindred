import { useEffect, useState, type JSX } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Check } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { useRingsToday, type RingProgress } from "@/hooks/useRings";

const SIZE = 36;
const STROKE = 4;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

const RINGS = [
  { key: "plan", label: "Plan", color: "var(--chart-1)" },
  { key: "do", label: "Do", color: "var(--chart-2)" },
  { key: "share", label: "Share", color: "var(--chart-3)" },
] as const;

const frac = (p: RingProgress) => (p.target > 0 ? Math.min(Math.max(p.current / p.target, 0), 1) : 0);

// A row-height reveal: collapsed to 0fr, expands to 1fr on the widget's group-hover.
function Reveal({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-out group-hover:grid-rows-[1fr]">
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

function MiniRing({
  label,
  color,
  progress,
  reveal,
}: {
  label: string;
  color: string;
  progress: RingProgress;
  reveal: boolean;
}): JSX.Element {
  const f = reveal ? frac(progress) : 0;
  return (
    <div className="flex flex-col items-center gap-1">
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
            strokeDashoffset={CIRC * (1 - f)}
            style={{ stroke: color, transition: "stroke-dashoffset 800ms ease-out" }}
          />
        </svg>
        {progress.closed ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Check size={14} weight="bold" style={{ color }} />
          </div>
        ) : null}
      </div>
      <ThemedText type="caption" className="text-[10px] leading-none">
        {label}
      </ThemedText>
      <Reveal>
        <ThemedText type="caption" className="pt-0.5 text-[10px] leading-none tabular-nums">
          {progress.current}/{progress.target}
        </ThemedText>
      </Reveal>
    </div>
  );
}

// Always-visible mini rings for non-home pages — three separate rings so each is identifiable.
// Hover expands to reveal a header + each ring's count. Hidden on home / when complete (dev shows all).
export function FloatingRings(): JSX.Element | null {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { data } = useRingsToday();
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReveal(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const alwaysShow = import.meta.env.DEV;
  if (!data) return null;
  if (!alwaysShow && (pathname === "/" || data.ring_state.all_closed)) return null;

  const open = RINGS.filter((r) => !data.ring_state[r.key].closed).length;

  return (
    <button
      type="button"
      onClick={() => navigate("/")}
      title={`${open} ring${open === 1 ? "" : "s"} left today`}
      aria-label={`${open} rings left today — go to home`}
      className="group fixed bottom-6 right-6 z-40 flex flex-col rounded-2xl border bg-card px-3.5 py-2.5 text-left shadow-lg transition-shadow hover:shadow-xl"
    >
      <Reveal>
        <ThemedText type="defaultSemiBold" className="pb-1.5 text-xs">
          {open > 0 ? `Today · ${open} left` : "All rings closed 🎉"}
        </ThemedText>
      </Reveal>
      <div className="flex items-start gap-3">
        {RINGS.map((r) => (
          <MiniRing key={r.key} label={r.label} color={r.color} progress={data.ring_state[r.key]} reveal={reveal} />
        ))}
      </div>
    </button>
  );
}

export default FloatingRings;
