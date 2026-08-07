import { ThemedText } from "@/components/ThemedText";
import { directionClass } from "./status";
import type { AnalyticsResponse } from "./types";

export function SignalStrip({ signals }: { signals: AnalyticsResponse["signals"] }) {
  const items = [signals.momentum, signals.timing, signals.support];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {items.map((signal) => (
        <div key={signal.label} className="rounded-2xl border border-border p-4">
          <ThemedText type="caption">{signal.label}</ThemedText>
          <ThemedText type="fancyFrauncesHeading" className="mt-1 block text-2xl">
            {signal.value}
          </ThemedText>
          <ThemedText type="caption" className={directionClass(signal.direction)}>
            {signal.deltaLabel}
          </ThemedText>
        </div>
      ))}
    </div>
  );
}
