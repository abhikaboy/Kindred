import { useEffect, useState, type JSX } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Check } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { useRingsToday, type RingProgress } from "@/hooks/useRings";

// Compact echo of home's ProductivityRings: primary-purple fill on a neutral track.
const SIZE = 60;
const STROKE = 6;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

const RINGS = [
  { key: "plan", label: "Plan" },
  { key: "do", label: "Do" },
  { key: "share", label: "Share" },
] as const;

const frac = (p: RingProgress) => (p.target > 0 ? Math.min(Math.max(p.current / p.target, 0), 1) : 0);

function MiniRing({ label, progress, reveal }: { label: string; progress: RingProgress; reveal: boolean }): JSX.Element {
  const f = reveal ? frac(progress) : 0;
  return (
    <div className="flex flex-col items-center gap-1.5">
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
            style={{ stroke: "var(--primary)", transition: "stroke-dashoffset 800ms ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {progress.closed ? (
            <Check size={20} weight="bold" className="text-primary" />
          ) : (
            <ThemedText type="defaultSemiBold" className="text-xs tabular-nums">
              {progress.current}/{progress.target}
            </ThemedText>
          )}
        </div>
      </div>
      <ThemedText type="caption" className="text-[11px] uppercase leading-none tracking-widest">
        {label}
      </ThemedText>
    </div>
  );
}

// Always-visible mini rings for non-home pages. Hidden on home / when complete (dev shows all).
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
      className="fixed bottom-6 right-6 z-40 flex flex-col gap-3 rounded-3xl border bg-card px-5 py-4 text-left shadow-lg transition-transform hover:-translate-y-0.5 hover:shadow-xl"
    >
      <ThemedText type="caption" className="uppercase tracking-widest">
        {open > 0 ? `Today · ${open} left` : "All closed 🎉"}
      </ThemedText>
      <div className="flex items-start gap-5">
        {RINGS.map((r) => (
          <MiniRing key={r.key} label={r.label} progress={data.ring_state[r.key]} reveal={reveal} />
        ))}
      </div>
    </button>
  );
}

export default FloatingRings;
