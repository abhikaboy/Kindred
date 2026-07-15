import { Link } from "react-router-dom";
import { CaretRight } from "@phosphor-icons/react";
import { useWorkspaces, type WorkspaceResult } from "@/hooks/useWorkspaces";
import { WorkspaceIcon } from "@/components/WorkspaceIcon";
import { TaskItem } from "@/components/TaskItem";
import { SwipeToComplete } from "@/components/SwipeToComplete";
import { ThemedText } from "@/components/ThemedText";
import { SectionHeader } from "@/components/home/SectionHeader";
import { BentoTile } from "@/components/home/BentoTile";
import { Skeleton } from "@/components/ui/skeleton";

const PREVIEW_COUNT = 2;

// Stamp categoryID (lost when flattening) so rows can resolve their category on complete.
const pendingTasks = (ws: WorkspaceResult) =>
  (ws.categories ?? []).flatMap((c) =>
    (c.tasks ?? []).map((t) => ({ ...t, categoryID: t.categoryID ?? c.id }))
  );

function WorkspaceRow({ ws }: { ws: WorkspaceResult }) {
  const tasks = pendingTasks(ws);
  const url = `/workspace/${encodeURIComponent(ws.name)}`;
  const preview = tasks.slice(0, PREVIEW_COUNT);
  const railStyle = ws.color ? { backgroundColor: ws.color } : undefined;
  return (
    <div className="flex h-full flex-col">
      {/* Full-opacity accent rail along the header... */}
      <div className="relative pl-4">
        <span
          className="absolute inset-y-0 left-0 w-[3px] rounded-t-full bg-border"
          style={railStyle}
        />
        <Link to={url} className="flex items-center gap-2 py-2">
          <WorkspaceIcon name={ws.icon} color={ws.color} size={18} />
          <ThemedText type="defaultSemiBold" className="flex-1 truncate">
            {ws.name}
          </ThemedText>
          <ThemedText type="caption">{tasks.length}</ThemedText>
          <CaretRight size={16} className="text-muted-foreground" />
        </Link>
      </div>
      {/* ...half-opacity rail continues down the rest of the (uniform) card. */}
      <div className="relative flex flex-1 flex-col gap-2 pb-1 pl-4">
        <span
          className="absolute inset-y-0 left-0 w-[3px] rounded-b-full bg-border opacity-50"
          style={railStyle}
        />
        {preview.map((task) => (
          <SwipeToComplete key={task.id} task={task} categoryId={task.categoryID ?? ""}>
            <TaskItem task={task} />
          </SwipeToComplete>
        ))}
      </div>
    </div>
  );
}

export function PersonalWorkspaces() {
  const { data, isLoading } = useWorkspaces();
  const workspaces = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader title="Personal Workspaces" />
      {isLoading ? (
        <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-3xl" />
          ))}
        </div>
      ) : workspaces.length > 0 ? (
        <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {workspaces.map((ws) => (
            <BentoTile key={ws.name} contentClassName="h-full">
              <WorkspaceRow ws={ws} />
            </BentoTile>
          ))}
        </div>
      ) : (
        <ThemedText type="caption" className="text-muted-foreground">
          No workspaces yet.
        </ThemedText>
      )}
    </div>
  );
}
