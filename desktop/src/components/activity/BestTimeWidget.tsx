import { ThemedText } from "@/components/ThemedText";
import { WidgetCard } from "./WidgetCard";
import type { AnalyticsResponse } from "./types";

// Backend weekdays are Monday-indexed (0 = Mon).
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// Columns are 3-hour blocks so the grid stays readable at a glance.
const BLOCKS = [0, 3, 6, 9, 12, 15, 18, 21];
const blockLabel = (h: number) => (h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`);

// When you actually finish things: weekday by time of day.
export function BestTimeWidget({ bestTime }: { bestTime: AnalyticsResponse["bestTime"] }) {
  const counts = new Map<string, number>();
  for (const cell of bestTime.cells ?? []) {
    const key = `${cell.weekday}:${Math.floor(cell.hour / 3) * 3}`;
    counts.set(key, (counts.get(key) ?? 0) + cell.count);
  }
  const max = Math.max(1, ...counts.values());

  return (
    <WidgetCard title="When you get things done" takeaway={bestTime.takeaway}>
      <div className="grid grid-cols-[32px_repeat(8,minmax(0,1fr))] gap-1">
        <span />
        {BLOCKS.map((h) => (
          <ThemedText key={h} type="caption" className="text-center tabular-nums">
            {blockLabel(h)}
          </ThemedText>
        ))}
        {WEEKDAYS.map((day, d) => (
          <div key={day} className="contents">
            <ThemedText type="caption">{day}</ThemedText>
            {BLOCKS.map((h) => {
              const count = counts.get(`${d}:${h}`) ?? 0;
              return (
                <div
                  key={h}
                  title={`${day} ${blockLabel(h)}: ${count} done`}
                  className="h-6 rounded-md bg-primary"
                  style={{ opacity: count ? 0.15 + 0.85 * (count / max) : 0.06 }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}
