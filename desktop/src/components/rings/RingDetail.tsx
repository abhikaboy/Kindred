import { useNavigate } from "react-router-dom";
import { ThemedText } from "@/components/ThemedText";
import { useCreate } from "@/components/create/CreateContext";
import { useRingsHistory, type RingProgress, type RingState } from "@/hooks/useRings";
import { RING_COLORS, type RingKey } from "@shared/rings";

const RING_LABELS: Record<RingKey, string> = { plan: "Plan", do: "Do", share: "Share" };

const RING_GUIDANCE: Record<RingKey, string> = {
  plan: "Create or schedule tasks to close this ring",
  do: "Complete tasks to close this ring",
  share: "Post an update or send kudos to close this ring",
};

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

const MINI_SIZE = 28;
const MINI_STROKE = 3;
const MINI_RADIUS = (MINI_SIZE - MINI_STROKE) / 2;
const MINI_CIRC = 2 * Math.PI * MINI_RADIUS;

// Mirrors mobile ExpandedRingDetail: the last 7 days oldest-first, matched on ISO date.
function buildHistory(history: RingState[], key: RingKey) {
  const today = new Date();
  return Array.from({ length: 7 }, (_, n) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (6 - n));
    const dateStr = date.toISOString().split("T")[0];
    const state = history.find((h) => new Date(h.date).toISOString().split("T")[0] === dateStr);
    const ring = state?.[key];
    return {
      dayLabel: DAY_LABELS[(date.getDay() + 6) % 7],
      fraction: ring && ring.target > 0 ? Math.min(ring.current / ring.target, 1) : 0,
    };
  });
}

/** Today's progress, guidance, a 7-day strip, and shortcuts for one ring. */
export function RingDetail({ ringKey, today, onNavigate }: { ringKey: RingKey; today: RingProgress; onNavigate?: () => void }) {
  const { data } = useRingsHistory();
  const navigate = useNavigate();
  const { openCreateTask, openCreatePost } = useCreate();
  const color = RING_COLORS[ringKey];
  const entries = buildHistory(data?.history ?? [], ringKey);

  const ctas: Record<RingKey, { label: string; run: () => void }[]> = {
    plan: [
      { label: "Plan Today", run: () => navigate("/calendar") },
      { label: "Quick Add", run: () => openCreateTask() },
    ],
    do: [{ label: "View Tasks", run: () => navigate("/calendar") }],
    share: [
      { label: "Make a Post", run: () => openCreatePost() },
      { label: "Send Kudos", run: () => navigate("/feed") },
    ],
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <ThemedText type="subtitle">
          {RING_LABELS[ringKey]} — {today.current} / {today.target}
        </ThemedText>
        {today.closed && <ThemedText type="caption">Closed!</ThemedText>}
      </div>
      {!today.closed && <ThemedText type="caption">{RING_GUIDANCE[ringKey]}</ThemedText>}

      <div className="flex justify-between px-2">
        {entries.map((e, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <svg width={MINI_SIZE} height={MINI_SIZE} className="-rotate-90">
              <circle cx={MINI_SIZE / 2} cy={MINI_SIZE / 2} r={MINI_RADIUS} fill="none" strokeWidth={MINI_STROKE} className="stroke-border" />
              {e.fraction > 0 && (
                <circle
                  cx={MINI_SIZE / 2}
                  cy={MINI_SIZE / 2}
                  r={MINI_RADIUS}
                  fill="none"
                  strokeWidth={MINI_STROKE}
                  strokeLinecap="round"
                  strokeDasharray={MINI_CIRC}
                  strokeDashoffset={MINI_CIRC * (1 - e.fraction)}
                  stroke={color}
                />
              )}
            </svg>
            <span className="font-sans text-[10px] text-muted-foreground">{e.dayLabel}</span>
          </div>
        ))}
      </div>

      <div className="mt-1 flex flex-wrap gap-2">
        {ctas[ringKey].map((cta) => (
          <button
            key={cta.label}
            type="button"
            onClick={() => {
              onNavigate?.();
              cta.run();
            }}
            className="rounded-full px-5 py-3 font-sans text-[15px] font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: color }}
          >
            {cta.label}
          </button>
        ))}
      </div>
    </div>
  );
}
