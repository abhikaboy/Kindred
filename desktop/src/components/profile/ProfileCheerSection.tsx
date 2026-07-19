import { useMemo } from "react";
import { Sparkle } from "@phosphor-icons/react";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useKudos, type EncouragementDocument } from "@/hooks/useKudos";
import { TaskItem } from "@/components/TaskItem";
import { ThemedText } from "@/components/ThemedText";

const MAX = 6;

// Public, uncompleted tasks are the surface friends can send kudos on (mirrors the
// mobile profile task list). On your own profile it's read-only: it showcases those
// tasks and the kudos they've already received.
export function ProfileCheerSection() {
  const { data: workspaces } = useWorkspaces();
  const { encouragements } = useKudos();

  const publicTasks = useMemo(
    () =>
      (workspaces ?? [])
        .flatMap((ws) => ws.categories ?? [])
        .flatMap((c) => c.tasks ?? [])
        .filter((t) => t.public),
    [workspaces],
  );

  // Received task-scoped kudos, grouped by the task they cheered.
  const kudosByTask = useMemo(() => {
    const map = new Map<string, EncouragementDocument[]>();
    for (const e of encouragements) {
      if (e.scope !== "task" || !e.taskId) continue;
      map.set(e.taskId, [...(map.get(e.taskId) ?? []), e]);
    }
    return map;
  }, [encouragements]);

  const shown = publicTasks.slice(0, MAX);
  const extra = publicTasks.length - shown.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <ThemedText type="subtitle" as="h3">
          Cheer me on
        </ThemedText>
        <ThemedText type="caption" className="text-muted-foreground">
          Public tasks friends can send kudos on
        </ThemedText>
      </div>

      {publicTasks.length === 0 ? (
        <ThemedText type="caption" className="text-muted-foreground">
          Make a task public to let friends cheer you on.
        </ThemedText>
      ) : (
        <>
          {shown.map((task) => {
            const kudos = kudosByTask.get(task.id) ?? [];
            return (
              <div key={task.id} className="flex flex-col gap-2">
                <TaskItem task={task} linkToDetail />
                {kudos.length > 0 && (
                  <div className="flex items-center gap-2 pl-1">
                    <div className="flex -space-x-2">
                      {kudos.slice(0, 5).map((k) => (
                        <img
                          key={k.id}
                          src={k.sender.picture}
                          alt={k.sender.name}
                          className="size-6 rounded-full object-cover ring-2 ring-background"
                        />
                      ))}
                    </div>
                    <ThemedText type="caption" className="flex items-center gap-1 text-muted-foreground">
                      <Sparkle size={12} weight="fill" className="text-primary" />
                      {kudos.length} {kudos.length === 1 ? "cheer" : "cheers"}
                    </ThemedText>
                  </div>
                )}
              </div>
            );
          })}
          {extra > 0 && (
            <ThemedText type="caption" className="text-muted-foreground">
              +{extra} more public {extra === 1 ? "task" : "tasks"}
            </ThemedText>
          )}
        </>
      )}
    </div>
  );
}
