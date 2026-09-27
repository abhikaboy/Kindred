import { useEffect, useState } from "react";
import type { RingProgress } from "@/hooks/useRings";
import { RING_COLORS, type RingKey } from "@shared/rings";

export const RING_ORDER: RingKey[] = ["plan", "do", "share"];

// Floor at a small sliver so an empty ring still shows its color (matches mobile).
const MIN_SLIVER = 0.03;

function fraction(p: RingProgress): number {
  const f = p.target > 0 ? Math.min(Math.max(p.current / p.target, 0), 1) : 0;
  return Math.max(f, MIN_SLIVER);
}

function RingArc({
  progress,
  color,
  size,
  radius,
  strokeWidth,
}: {
  progress: RingProgress;
  color: string;
  size: number;
  radius: number;
  strokeWidth: number;
}) {
  const target = fraction(progress);
  const circ = 2 * Math.PI * radius;
  const [fill, setFill] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFill(target));
    return () => cancelAnimationFrame(id);
  }, [target]);
  const c = size / 2;

  return (
    <>
      <circle cx={c} cy={c} r={radius} fill="none" strokeWidth={strokeWidth} stroke={color + "1A"} />
      <circle
        cx={c}
        cy={c}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - fill)}
        stroke={color}
        style={{ transition: "stroke-dashoffset 800ms ease-out" }}
      />
    </>
  );
}

/** Plan / Do / Share drawn as one concentric set, outer to inner, with optional center content. */
export function ConcentricRings({
  rings,
  size = 132,
  strokeWidth = 12,
  gap = 4,
  dimmedExcept,
  center,
}: {
  rings: Record<RingKey, RingProgress>;
  size?: number;
  strokeWidth?: number;
  gap?: number;
  dimmedExcept?: RingKey | null;
  center?: React.ReactNode;
}) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {RING_ORDER.map((key, index) => (
          <g
            key={key}
            opacity={dimmedExcept && dimmedExcept !== key ? 0.3 : 1}
            style={{ transition: "opacity 200ms ease-out" }}
          >
            <RingArc
              progress={rings[key]}
              color={RING_COLORS[key]}
              size={size}
              radius={(size - strokeWidth) / 2 - index * (strokeWidth + gap)}
              strokeWidth={strokeWidth}
            />
          </g>
        ))}
      </svg>
      {center != null && <div className="absolute inset-0 flex items-center justify-center">{center}</div>}
    </div>
  );
}
