import { ThemedText } from "@/components/ThemedText";
import { cn } from "@/lib/utils";
import { StatusText } from "./StatusText";
import { WidgetCard } from "./WidgetCard";
import type { AnalyticsResponse } from "./types";

export function HabitsWidget({ habits }: { habits: AnalyticsResponse["habits"] }) {
  const rows = habits.rows ?? [];

  return (
    <WidgetCard title="Habits & recurring" takeaway={habits.takeaway}>
      {rows.length === 0 ? (
        <ThemedText type="caption">No recurring tasks yet.</ThemedText>
      ) : (
        <div className="flex flex-col gap-5">
          {rows.map((row) => (
            <div key={row.templateId} className="flex flex-col gap-2">
              <div className="min-w-0">
                <ThemedText type="defaultSemiBold" className="block truncate">
                  {row.title}
                </ThemedText>
                <ThemedText type="caption">
                  {row.rhythmLabel} · {row.completed}/{row.total} kept up
                  <StatusText status={row.status} />
                </ThemedText>
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
