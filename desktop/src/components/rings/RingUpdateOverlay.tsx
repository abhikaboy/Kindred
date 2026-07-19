import { useEffect, useRef, useState, type JSX } from "react";
import { Check } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { fireConfetti } from "@/lib/confetti";
import { useRingUpdate } from "@/components/rings/RingUpdateContext";

const SIZE = 88;
const STROKE = 7;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
const PRIMARY = "#854DFF";
const TRACK = "rgba(255,255,255,0.18)";

const LABELS: Record<string, string> = { plan: "Plan", do: "Do", share: "Share" };

// Phased timings mirror the mobile RingUpdateOverlay: gradient dims in, ring drops
// in, the arc animates previous→current, hold, then it all lifts away.
const RING_IN = 1000;
const ARC_AT = 1700;
const ENTER_TOTAL = 2500;
const CLOSE_FX = 2380;

const clampFrac = (n: number, target: number) => Math.min(Math.max(n, 0) / (target > 0 ? target : 1), 1);

// Dark-gradient ring-fill celebration shown after a task completes / a ring closes.
export function RingUpdateOverlay(): JSX.Element | null {
  const { currentDelta, onAnimationComplete } = useRingUpdate();
  const ringRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [grad, setGrad] = useState(0);
  const [ringIn, setRingIn] = useState(false);
  const [arc, setArc] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (!currentDelta) return;
    setMounted(true);
    setGrad(0);
    setRingIn(false);
    setArc(false);
    setClosed(false);

    const timers: number[] = [];
    const at = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));

    const raf = requestAnimationFrame(() => setGrad(1)); // gradient dims in
    at(() => setRingIn(true), RING_IN); // ring drops in
    at(() => setArc(true), ARC_AT); // arc animates to current
    if (currentDelta.just_closed) {
      at(() => {
        setClosed(true);
        fireConfetti(ringRef.current);
      }, CLOSE_FX);
    }
    const hold = currentDelta.just_closed ? 1600 : 500;
    const exitStart = ENTER_TOTAL + hold;
    at(() => setRingIn(false), exitStart); // ring lifts away first
    at(() => setGrad(0), exitStart + 220); // gradient lingers, then fades
    at(() => {
      setMounted(false);
      onAnimationComplete();
    }, exitStart + 220 + 720);

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDelta]);

  if (!mounted || !currentDelta) return null;

  const prev = clampFrac(currentDelta.previous, currentDelta.target);
  const cur = clampFrac(currentDelta.current, currentDelta.target);
  const offset = CIRC * (1 - (arc ? cur : prev));
  const label = LABELS[currentDelta.ring] ?? currentDelta.ring;
  const celebration = currentDelta.just_closed_all ? "All rings closed!" : `${label} ring closed!`;

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]">
      <div
        className="absolute inset-y-0 right-0 w-[45vw]"
        style={{
          opacity: grad,
          transition: "opacity 900ms ease",
          background:
            "linear-gradient(to left, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.28) 42%, transparent 100%)",
        }}
      />

      <div
        ref={ringRef}
        className="absolute right-12 top-1/2 flex flex-col items-center gap-3"
        style={{
          opacity: ringIn ? 1 : 0,
          transform: `translate(${ringIn ? 0 : 56}px, -50%)`,
          transition: "opacity 500ms ease, transform 520ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">{label}</span>
        <div className="relative grid place-items-center" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE} className="-rotate-90">
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke={TRACK} strokeWidth={STROKE} />
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke={PRIMARY}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 800ms cubic-bezier(0.65,0,0.35,1)" }}
            />
          </svg>
          <div className="absolute grid place-items-center">
            {closed ? (
              <Check size={30} weight="bold" style={{ color: PRIMARY }} />
            ) : (
              <span className="text-[15px] font-semibold text-white">
                {currentDelta.current}/{currentDelta.target}
              </span>
            )}
          </div>
        </div>
        {currentDelta.just_closed && closed ? (
          <ThemedText className="text-base font-semibold text-white">{celebration}</ThemedText>
        ) : null}
      </div>
    </div>
  );
}

export default RingUpdateOverlay;
