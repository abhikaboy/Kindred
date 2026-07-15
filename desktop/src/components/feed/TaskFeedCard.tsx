import { useState, type JSX } from "react";
import { Sparkle } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/ui/button";
import { SendKudosModal } from "@/components/notifications/SendKudosModal";
import { useAuth } from "@/contexts/auth";
import { formatNotificationTime } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import type { components } from "@/lib/api/types.gen";

// Mirrors desktop TaskItem's PRIORITY_DOT (1→green, 2→amber, 3→red, else muted).
const PRIORITY_DOT: Record<number, string> = {
  1: "bg-emerald-500",
  2: "bg-amber-500",
  3: "bg-destructive",
};

export function TaskFeedCard({
  task,
}: {
  task: components["schemas"]["FeedTaskData"];
}): JSX.Element {
  const { user } = useAuth();
  const [kudosOpen, setKudosOpen] = useState(false);

  const isOwn = user?._id === task.user._id;
  const dotColor = PRIORITY_DOT[task.priority] ?? "bg-muted-foreground";

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <img
          src={task.user.profile_picture}
          alt=""
          className="h-10 w-10 rounded-full object-cover"
        />
        <div className="flex flex-col">
          <ThemedText type="defaultSemiBold">{task.user.display_name}</ThemedText>
          <ThemedText type="caption">
            @{task.user.handle} · {formatNotificationTime(new Date(task.timestamp).getTime())}
          </ThemedText>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <ThemedText type="default" as="p">
          completed <ThemedText type="defaultSemiBold">{task.content}</ThemedText>
        </ThemedText>
        <ThemedText type="caption" as="p" className="flex items-center gap-1.5">
          <span className={cn("inline-block h-2 w-2 rounded-full", dotColor)} />
          {task.workspaceName} · {task.categoryName}
        </ThemedText>
      </div>

      {!isOwn && (
        <div>
          <Button size="sm" variant="outline" onClick={() => setKudosOpen(true)}>
            <Sparkle weight="fill" />
            Encourage
          </Button>
        </div>
      )}

      <SendKudosModal
        open={kudosOpen}
        onClose={() => setKudosOpen(false)}
        kind="encouragement"
        scope="task"
        taskId={task.id}
        taskName={task.content}
        categoryName={task.categoryName}
        receiverId={task.user._id}
        recipientName={task.user.display_name}
      />
    </div>
  );
}

export default TaskFeedCard;
