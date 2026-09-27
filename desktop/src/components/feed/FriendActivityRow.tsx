import { useState, type JSX } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Confetti, HandWaving } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConcentricRings } from "@/components/rings/ConcentricRings";
import { SendKudosModal } from "@/components/notifications/SendKudosModal";
import { FriendSupportPicker } from "@/components/feed/FriendSupportPicker";
import { categoryOptions, useFriendSupport } from "@/hooks/useFriendSupport";
import { friendProfileOptions } from "@/hooks/useFriendProfiles";
import {
  activityStatus,
  buildOptions,
  isToday,
  type FriendActivity,
  type FriendProfile,
  type FriendTask,
  type SupportKind,
} from "@/lib/friendActivity";
import type { components } from "@/lib/api/types.gen";

type FriendReference = components["schemas"]["FriendReference"];

// Category name for the "Write your own" modal's task chip; "General" when unknown.
function useCategoryName(id?: string): string {
  const { data } = useQuery({ ...categoryOptions(id ?? ""), enabled: !!id });
  return data?.name || "General";
}

export function FriendActivityRow({
  friend,
  profile,
  activity,
}: {
  friend: FriendReference;
  profile?: FriendProfile;
  activity: FriendActivity;
}): JSX.Element {
  const qc = useQueryClient();
  const firstName = friend.display_name.split(" ")[0];
  const { send, sendingId, isSent } = useFriendSupport(friend._id, friend.display_name);
  const [picker, setPicker] = useState<SupportKind | null>(null);
  const [custom, setCustom] = useState<SupportKind | null>(null);

  const rings = profile?.ring_state;
  const nudgeOptions = buildOptions("nudge", profile);
  const congratsOptions = buildOptions("congratulate", profile);
  const workingTask: FriendTask | undefined = activity.kind === "working" ? activity.task : undefined;
  const latestFinished = profile?.completed_tasks?.find((t) => isToday(t.timeCompleted));
  const workingCategory = useCategoryName(workingTask?.categoryID);
  const finishedCategory = useCategoryName(latestFinished?.categoryID);

  const pick = async (kind: SupportKind, option: (typeof nudgeOptions)[number]) => {
    if (await send(kind, option)) setPicker(null);
  };
  const openCustom = (kind: SupportKind) => {
    setPicker(null);
    setCustom(kind);
  };
  const pickerFor = (kind: SupportKind) => ({
    open: picker === kind,
    onOpenChange: (open: boolean) => setPicker(open ? kind : null),
    isSent: (id: string) => isSent(kind, id),
    sendingId,
    onPick: (option: (typeof nudgeOptions)[number]) => void pick(kind, option),
  });

  return (
    <div className="flex flex-col gap-2 py-2">
      <div className="flex items-center gap-3">
        <Link to={`/account/${friend._id}`} className="flex min-w-0 flex-1 items-center gap-3 transition-opacity hover:opacity-80">
          <span className="relative shrink-0">
            <img src={friend.profile_picture} alt={friend.display_name} className="size-9 rounded-full bg-muted object-cover" />
            {activity.kind === "working" ? (
              <span className="absolute -bottom-px -right-px size-3 rounded-full border-2 border-card bg-emerald-500" />
            ) : null}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <ThemedText type="defaultSemiBold" className="truncate text-sm">
              {friend.display_name}
            </ThemedText>
            {profile ? (
              <ThemedText type="caption" className="line-clamp-2 text-xs">
                {activityStatus(activity, rings)}
              </ThemedText>
            ) : (
              <Skeleton className="mt-1 h-3 w-32" />
            )}
          </span>
        </Link>
        {rings ? (
          <ConcentricRings
            rings={rings}
            size={56}
            strokeWidth={5}
            gap={2}
            center={<ThemedText type="caption" className="text-xs">{profile?.productivity_score}</ThemedText>}
          />
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <FriendSupportPicker
          {...pickerFor("nudge")}
          title={`Nudge ${firstName} to...`}
          options={nudgeOptions}
          onWriteOwn={() => openCustom("nudge")}
          trigger={
            <Button variant="secondary" size="sm" className="flex-1 cursor-pointer text-primary" disabled={!profile}>
              <HandWaving weight="fill" /> Nudge
            </Button>
          }
        />
        <FriendSupportPicker
          {...pickerFor("congratulate")}
          title={`Congratulate ${firstName} on...`}
          options={congratsOptions}
          onWriteOwn={latestFinished ? () => openCustom("congratulate") : undefined}
          trigger={
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 cursor-pointer text-primary"
              disabled={congratsOptions.length === 0}
            >
              <Confetti weight="fill" /> Congratulate
            </Button>
          }
        />
      </div>

      <SendKudosModal
        open={custom !== null}
        onClose={() => setCustom(null)}
        recipientName={friend.display_name}
        receiverId={friend._id}
        onSent={() => qc.invalidateQueries({ queryKey: friendProfileOptions(friend._id).queryKey })}
        {...(custom === "congratulate"
          ? {
              kind: "congratulation" as const,
              taskName: latestFinished?.content,
              categoryName: finishedCategory,
            }
          : workingTask
            ? {
                kind: "encouragement" as const,
                scope: "task" as const,
                taskId: workingTask.id,
                taskName: workingTask.content,
                categoryName: workingCategory,
              }
            : { kind: "encouragement" as const, scope: "profile" as const })}
      />
    </div>
  );
}
