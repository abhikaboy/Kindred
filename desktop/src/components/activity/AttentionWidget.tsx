import { Link } from "react-router-dom";
import { ThemedText } from "@/components/ThemedText";
import { WidgetCard } from "./WidgetCard";
import type { AnalyticsResponse } from "./types";

const MAX_ROWS = 5;

// Tasks that have stalled or slipped, each linking straight to the task.
export function AttentionWidget({ attention }: { attention: AnalyticsResponse["attention"] }) {
  const tasks = attention.tasks ?? [];
  if (tasks.length === 0) return null;

  return (
    <WidgetCard
      title="Needs attention"
      takeaway={`${tasks.length} ${tasks.length === 1 ? "task has" : "tasks have"} stalled or slipped`}
    >
      <div className="flex flex-col gap-1">
        {tasks.slice(0, MAX_ROWS).map((task) => (
          <Link
            key={task.id}
            to={`/task/${task.id}`}
            className="-mx-2 flex flex-col gap-1 rounded-lg px-2 py-2 transition-colors hover:bg-muted"
          >
            <ThemedText type="defaultSemiBold" className="truncate">
              {task.title}
            </ThemedText>
            <ThemedText type="caption" className="truncate">
              {[...(task.reasons ?? []), `${task.workspace} / ${task.category}`].join(" · ")}
            </ThemedText>
          </Link>
        ))}
      </div>
    </WidgetCard>
  );
}
