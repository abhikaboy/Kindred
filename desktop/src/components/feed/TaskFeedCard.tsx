import { useState, type JSX } from "react";
import { Link } from "react-router-dom";
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
    <div className="rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        <Link to={`/account/${task.user._id}`} className="shrink-0">
          <img
            src={task.user.profile_picture}
            alt=""
            className="h-10 w-10 rounded-full object-cover"
          />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 items-baseline gap-1.5">
              <Link to={`/account/${task.user._id}`} className="hover:underline">
                <ThemedText type="defaultSemiBold" as="span">
                  {task.user.display_name}
                </ThemedText>
              </Link>
              <ThemedText type="caption" as="span" className="shrink-0">
                · {formatNotificationTime(new Date(task.timestamp).getTime())}
              </ThemedText>
            </div>
            {!isOwn && (
              <Button
                size="sm"
                variant="outline"
                className="ml-auto shrink-0"
                onClick={() => setKudosOpen(true)}
              >
                <Sparkle weight="fill" />
                Encourage
              </Button>
            )}
          </div>
          <ThemedText type="default" as="p">
            completed <ThemedText type="defaultSemiBold">{task.content}</ThemedText>
          </ThemedText>
          <ThemedText type="caption" as="p" className="flex items-center gap-1.5">
            <span className={cn("inline-block h-2 w-2 rounded-full", dotColor)} />
            {task.workspaceName} · {task.categoryName}
          </ThemedText>
        </div>
      </div>

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
