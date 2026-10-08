import { Link } from "react-router-dom";
import { ThemedText } from "@/components/ThemedText";
import { StatusText } from "./StatusText";
import { WidgetCard } from "./WidgetCard";
import type { AnalyticsResponse } from "./types";

export function WorkspaceHealthWidget({ workspaceHealth }: { workspaceHealth: AnalyticsResponse["workspaceHealth"] }) {
  const rows = workspaceHealth.rows ?? [];

  return (
    <WidgetCard title="Workspace health">
      {rows.length === 0 ? (
        <ThemedText type="caption">No workspace activity in this period yet.</ThemedText>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <Link
              key={row.workspace}
              to={`/workspace/${encodeURIComponent(row.workspace)}`}
              className="flex items-center justify-between gap-3 -mx-2 rounded-lg px-2 py-2 transition-colors hover:bg-muted"
            >
              <div className="min-w-0">
                <ThemedText type="defaultSemiBold" className="block truncate">
                  {row.workspace}
                </ThemedText>
                <ThemedText type="caption">
                  {row.done} done · {row.onTimePct}% on time · {row.kudos} kudos
                  <StatusText status={row.status} />
                </ThemedText>
              </div>
            </Link>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
