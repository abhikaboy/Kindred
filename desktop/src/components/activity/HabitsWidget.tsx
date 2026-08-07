import { ThemedText } from "@/components/ThemedText";
import { cn } from "@/lib/utils";
import { StatusPill } from "./StatusPill";
import { WidgetCard } from "./WidgetCard";
import type { AnalyticsResponse } from "./types";

export function HabitsWidget({ habits }: { habits: AnalyticsResponse["habits"] }) {
  const rows = habits.rows ?? [];

  return (
    <WidgetCard title="Habits & recurring" takeaway={habits.takeaway}>
      {rows.length === 0 ? (
        <ThemedText type="caption">No recurring tasks yet.</ThemedText>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((row) => (
            <div key={row.templateId} className="flex flex-col gap-2 border-b border-border pb-4 last:border-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <ThemedText type="defaultSemiBold" className="block truncate text-sm">
                    {row.title}
                  </ThemedText>
                  <ThemedText type="caption">
                    {row.rhythmLabel} · {row.completed}/{row.total} kept up
                  </ThemedText>
                </div>
                <StatusPill status={row.status} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(row.dots ?? []).map((filled, i) => (
                  <span key={i} className={cn("size-2.5 rounded-full", filled ? "bg-primary" : "bg-muted")} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
