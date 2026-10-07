import { ThemedText } from "@/components/ThemedText";
import { directionClass } from "./status";
import type { AnalyticsResponse } from "./types";

export function SignalStrip({ signals }: { signals: AnalyticsResponse["signals"] }) {
  const items = [signals.momentum, signals.timing, signals.support];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {items.map((signal) => (
        <div key={signal.label} className="flex flex-col gap-1">
          <ThemedText type="caption">{signal.label}</ThemedText>
          <ThemedText type="defaultSemiBold" className="block text-2xl tabular-nums">
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
