import { Plus } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { TaskItem } from "@/components/TaskItem";
import { SwipeToComplete } from "@/components/SwipeToComplete";
import { useCreate } from "@/components/create/CreateContext";
import { Button } from "@/components/ui/button";
import type { CategoryDocument } from "@/hooks/useWorkspaces";

// Mirrors the mobile category block: a header (name + accent dot + task count)
// followed by the stacked task rows. `accent` is the workspace color.
export function CategoryCard({
  category,
  accent,
  shortcutIndex,
}: {
  category: CategoryDocument;
  accent?: string;
  shortcutIndex?: number;
}) {
  const { openCreateTask } = useCreate();
  const tasks = category.tasks ?? [];
  const empty = tasks.length === 0;

  return (
    <section className="group/category flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {accent && (
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: accent }}
          />
        )}
        {/* Click the name to add a task to this category. */}
        <button
          type="button"
          onClick={() => openCreateTask({ categoryId: category.id })}
          title={`Add a task to ${category.name}`}
          className="rounded text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ThemedText
            type="subtitle"
            className={empty ? "text-muted-foreground" : undefined}
          >
            {category.name}
          </ThemedText>
        </button>
        <ThemedText type="caption" className="text-muted-foreground">
          {tasks.length}
        </ThemedText>
        {shortcutIndex != null && (
          <span
            className="text-xs text-muted-foreground opacity-50"
            title={`Shift+${shortcutIndex}: new task here`}
          >
            ⇧{shortcutIndex}
          </span>
        )}
        {/* Quiet affordance: only surfaces on category hover/focus. */}
        <Button
          variant="ghost"
          size="xs"
          onClick={() => openCreateTask({ categoryId: category.id })}
          className="ml-auto text-muted-foreground opacity-0 transition-opacity group-focus-within/category:opacity-100 group-hover/category:opacity-100 focus-visible:opacity-100"
        >
          <Plus />
          New task
        </Button>
      </div>

      {empty ? (
        <ThemedText type="caption" className="text-muted-foreground">
          No tasks yet.
        </ThemedText>
      ) : (
        <div className="flex flex-col gap-3">
          {tasks.map((task) => (
            <SwipeToComplete key={task.id} task={task} categoryId={category.id}>
              <TaskItem task={task} />
            </SwipeToComplete>
          ))}
        </div>
      )}
    </section>
  );
}
