import { useState, type JSX } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkle, Check, LockSimple } from "@phosphor-icons/react";
import { $api } from "@/lib/api/query";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/ui/button";
import PrimaryButton from "@/components/PrimaryButton";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileIdentity } from "@/components/profile/ProfileIdentity";
import { ProfileGallery } from "@/components/profile/ProfileGallery";
import { TaskItem } from "@/components/TaskItem";
import { SendKudosModal } from "@/components/notifications/SendKudosModal";
import type { TaskDocument } from "@/hooks/useWorkspaces";
import {
  useSendRequest,
  useAcceptRequest,
  useRemoveConnection,
  type ProfileDocument,
} from "@/hooks/useConnections";

// Connection mutations require both auth headers; the client middleware fills the real tokens.
const AUTH = { Authorization: "", refresh_token: "" };

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col">
      <ThemedText type="defaultSemiBold" className="text-lg">
        {value}
      </ThemedText>
      <ThemedText type="caption">{label}</ThemedText>
    </div>
  );
}

// Relationship button (Add / Requested / Accept / Friends) + an Encourage kudos CTA.
function AccountActions({ profile }: { profile: ProfileDocument }): JSX.Element {
  const send = useSendRequest();
  const accept = useAcceptRequest();
  const remove = useRemoveConnection();
  const [kudosOpen, setKudosOpen] = useState(false);
  const busy = send.isPending || accept.isPending || remove.isPending;
  const status = profile.relationship?.status ?? "none";
  const requestId = profile.relationship?.request_id;

  return (
    <div className={busy ? "flex gap-3 opacity-50" : "flex gap-3"}>
      {status === "connected" ? (
        <span className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-primary/15 px-5 text-primary">
          <Check size={16} weight="bold" />
          <ThemedText type="defaultSemiBold" className="text-primary">
            Friends
          </ThemedText>
        </span>
      ) : status === "requested" ? (
        <PrimaryButton
          title="Requested"
          secondary
          className="h-11 w-auto px-5 py-0"
          disabled={busy || !requestId}
          onClick={() => requestId && remove.mutate({ params: { header: AUTH, path: { id: requestId } } })}
        />
      ) : status === "received" ? (
        <PrimaryButton
          title="Accept"
          className="h-11 w-auto px-5 py-0"
          disabled={busy || !requestId}
          onClick={() => requestId && accept.mutate({ params: { header: AUTH, path: { id: requestId } } })}
        />
      ) : (
        <PrimaryButton
          title="Add friend"
          className="h-11 w-auto px-5 py-0"
          disabled={busy}
          onClick={() => send.mutate({ params: { header: AUTH }, body: { receiver_id: profile.id } })}
        />
      )}

      <Button variant="outline" onClick={() => setKudosOpen(true)} className="h-11 px-5">
        <Sparkle weight="duotone" /> Encourage
      </Button>

      <SendKudosModal
        open={kudosOpen}
        onClose={() => setKudosOpen(false)}
        recipientName={profile.display_name}
        receiverId={profile.id}
        kind="encouragement"
        scope="profile"
      />
    </div>
  );
}

export default function AccountScreen() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [encourageTask, setEncourageTask] = useState<TaskDocument | null>(null);
  const { data: profile, isLoading } = $api.useQuery(
    "get",
    "/v1/user/profiles/{id}",
    { params: { path: { id: id ?? "" } } },
    { enabled: !!id }
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl pt-6">
        <div className="flex items-end gap-4 px-2 pt-2">
          <Skeleton className="size-28 rounded-full" />
          <Skeleton className="mb-2 h-8 w-48" />
        </div>
      </div>
    );
  }

  if (!profile || !profile.id) {
    return (
      <div className="mx-auto max-w-5xl pt-10 text-center">
        <ThemedText type="subtitle" as="h1">
          Account not found
        </ThemedText>
      </div>
    );
  }

  if (profile.relationship?.status === "self") {
    return <Navigate to="/profile" replace />;
  }

  const canView = profile.relationship?.status === "connected";
  const activeTasks = (profile.tasks ?? []).filter((t) => t.public);

  return (
    <div className="mx-auto max-w-5xl pt-6">
      <ProfileIdentity
        displayName={profile.display_name}
        handle={profile.handle}
        profilePicture={profile.profile_picture}
        actions={<AccountActions profile={profile} />}
      />

      <div className="mt-6 flex gap-8 px-2">
        <Stat value={profile.points} label="Points" />
        <Stat value={profile.tasks_complete} label="Completed" />
        <Stat value={profile.posts_made} label="Posts" />
        <Stat value={profile.friends.length} label="Friends" />
      </div>

      {canView ? (
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <ThemedText type="subtitle" as="h3">
              Tasks
            </ThemedText>
            {activeTasks.length === 0 ? (
              <ThemedText type="caption">Nothing public right now.</ThemedText>
            ) : (
              <div className="flex flex-col gap-3">
                {activeTasks.map((task) => (
                  <TaskItem key={task.id} task={task} onEncourage={() => setEncourageTask(task)} />
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <ThemedText type="subtitle" as="h3">
              Gallery
            </ThemedText>
            <ProfileGallery userId={profile.id} />
          </div>
        </div>
      ) : (
        <div className="mt-12 flex flex-col items-center gap-2 py-16 text-center">
          <LockSimple size={28} className="text-muted-foreground" />
          <ThemedText type="subtitle" as="h3">
            This profile is private
          </ThemedText>
          <ThemedText type="caption" className="max-w-xs">
            Connect with {profile.display_name} to see their activity, tasks, and posts.
          </ThemedText>
        </div>
      )}

      <SendKudosModal
        open={!!encourageTask}
        onClose={() => setEncourageTask(null)}
        recipientName={profile.display_name}
        receiverId={profile.id}
        kind="encouragement"
        scope="task"
        taskId={encourageTask?.id}
        taskName={encourageTask?.content}
        onSent={() => qc.invalidateQueries({ queryKey: ["get", "/v1/user/profiles/{id}"] })}
      />
    </div>
  );
}
