import { useState, type JSX } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Check, CheckCircle, Fire, HandsClapping, LockSimple, UserPlus, Users } from "@phosphor-icons/react";
import { $api } from "@/lib/api/query";
import { ThemedText } from "@/components/ThemedText";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileHero } from "@/components/profile/ProfileHero";
import { ProfileGallery } from "@/components/profile/ProfileGallery";
import { FriendshipMeter } from "@/components/profile/FriendshipMeter";
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

const PILL = "inline-flex h-9 items-center gap-1.5 rounded-full px-4 transition-[background-color,color,opacity,transform] duration-150 active:scale-[0.97] disabled:opacity-50";
const PRIMARY = `${PILL} bg-primary text-primary-foreground shadow-[0_6px_10px_-2px_rgba(133,77,255,0.3)] hover:opacity-95`;
const QUIET = `${PILL} bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground`;

// Friends: cheering them on is the main action. Not yet friends: connecting leads.
function AccountActions({ profile }: { profile: ProfileDocument }): JSX.Element {
  const send = useSendRequest();
  const accept = useAcceptRequest();
  const remove = useRemoveConnection();
  const [kudosOpen, setKudosOpen] = useState(false);
  const busy = send.isPending || accept.isPending || remove.isPending;
  const status = profile.relationship?.status ?? "none";
  const requestId = profile.relationship?.request_id;
  const friends = status === "connected";

  const cheer = (
    <button type="button" onClick={() => setKudosOpen(true)} className={friends ? PRIMARY : QUIET}>
      <HandsClapping size={16} weight="fill" />
      <ThemedText type="caption" className="text-inherit">
        Cheer {profile.display_name.split(" ")[0]} on
      </ThemedText>
    </button>
  );

  const relation = friends ? (
    <span className={`${PILL} text-muted-foreground`}>
      <Check size={14} weight="bold" />
      <ThemedText type="caption" className="text-inherit">Friends</ThemedText>
    </span>
  ) : status === "requested" ? (
    <button
      type="button"
      className={QUIET}
      disabled={busy || !requestId}
      onClick={() => requestId && remove.mutate({ params: { header: AUTH, path: { id: requestId } } })}
    >
      <ThemedText type="caption" className="text-inherit">Requested</ThemedText>
    </button>
  ) : status === "received" ? (
    <button
      type="button"
      className={PRIMARY}
      disabled={busy || !requestId}
      onClick={() => requestId && accept.mutate({ params: { header: AUTH, path: { id: requestId } } })}
    >
      <UserPlus size={16} weight="bold" />
      <ThemedText type="caption" className="text-inherit">Accept request</ThemedText>
    </button>
  ) : (
    <button
      type="button"
      className={PRIMARY}
      disabled={busy}
      onClick={() => send.mutate({ params: { header: AUTH }, body: { receiver_id: profile.id } })}
    >
      <UserPlus size={16} weight="bold" />
      <ThemedText type="caption" className="text-inherit">Add friend</ThemedText>
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {friends ? (
        <>
          {cheer}
          {relation}
        </>
      ) : (
        <>
          {relation}
          {cheer}
        </>
      )}
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

  const firstName = profile.display_name.split(" ")[0];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-12 pt-6">
      <ProfileHero
        userId={profile.id}
        displayName={profile.display_name}
        handle={profile.handle}
        picture={profile.profile_picture}
        rings={canView ? profile.ring_state : null}
        song={profile.song}
        showPhotos={canView}
        stats={[
          { icon: Fire, value: profile.streak, label: "day streak" },
          { icon: CheckCircle, value: profile.tasks_complete, label: "done" },
          { icon: Users, value: profile.friends.length, label: "friends" },
        ]}
        actions={<AccountActions profile={profile} />}
      />

      {canView ? (
        <>
          <FriendshipMeter score={profile.relationship?.score ?? 0} name={profile.display_name} />

          <section className="flex flex-col gap-3">
            <ThemedText type="subtitle" as="h2">
              Gallery
            </ThemedText>
            <ProfileGallery userId={profile.id} />
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <ThemedText type="subtitle" as="h2">
                Cheer {firstName} on
              </ThemedText>
              {activeTasks.length > 0 && (
                <ThemedText type="caption">
                  {activeTasks.length} task{activeTasks.length === 1 ? "" : "s"} {firstName} is working on. Pick one to send kudos.
                </ThemedText>
              )}
            </div>
            {activeTasks.length === 0 ? (
              <ThemedText type="caption">Nothing public right now.</ThemedText>
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {activeTasks.map((task) => (
                  <TaskItem key={task.id} task={task} onEncourage={() => setEncourageTask(task)} />
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
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
        categoryName="Encouragement"
        onSent={() => qc.invalidateQueries({ queryKey: ["get", "/v1/user/profiles/{id}"] })}
      />
    </div>
  );
}
