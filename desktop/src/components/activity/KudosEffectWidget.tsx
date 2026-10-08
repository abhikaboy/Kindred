import { ThemedText } from "@/components/ThemedText";
import { WidgetCard } from "./WidgetCard";
import type { AnalyticsResponse } from "./types";

const formatHours = (h: number) => (h < 24 ? `${Math.round(h)}h` : `${Math.round(h / 24)}d`);

// Median time-to-done for tasks with kudos vs without, as two comparable bars.
export function KudosEffectWidget({ effect }: { effect: AnalyticsResponse["kudosEffect"] }) {
  if (!effect.hasComparison) {
    return (
      <WidgetCard title="Does support help?">
        <ThemedText type="caption">
          Waiting for a fair comparison. We need 3 finished tasks with kudos and 3 without. You're at{" "}
          {effect.withCount} with kudos and {effect.withoutCount} without.
        </ThemedText>
      </WidgetCard>
    );
  }

  const rows = [
    { label: "With kudos", hours: effect.withKudosMedianHours, count: effect.withCount, primary: true },
    { label: "Without", hours: effect.withoutKudosMedianHours, count: effect.withoutCount, primary: false },
  ];
  const max = Math.max(1, ...rows.map((r) => r.hours));

  return (
    <WidgetCard title="Does support help?" takeaway={effect.takeaway}>
      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[88px_minmax(0,1fr)_48px] items-center gap-3">
            <ThemedText type="caption">{row.label}</ThemedText>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div
                className={row.primary ? "h-full rounded-full bg-primary" : "h-full rounded-full bg-muted-foreground/40"}
                style={{ width: `${Math.max(4, (row.hours / max) * 100)}%` }}
              />
            </div>
            <ThemedText type="defaultSemiBold" className="text-right tabular-nums">
              {formatHours(row.hours)}
            </ThemedText>
          </div>
        ))}
        <ThemedText type="caption">
          {effect.withCount} tasks with kudos, {effect.withoutCount} without · could be the kudos, could be that easier
          tasks get more cheers
        </ThemedText>
      </div>
    </WidgetCard>
  );
}
