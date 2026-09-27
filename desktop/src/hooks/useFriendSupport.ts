import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { $api } from "@/lib/api/query";
import { useKudosQuota } from "@/hooks/useKudosQuota";
import { useFriendshipBump } from "@/hooks/useFriendshipBump";
import { useRingUpdate } from "@/components/rings/RingUpdateContext";
import { friendProfileOptions } from "@/hooks/useFriendProfiles";
import type { FriendSupportOption, SupportKind } from "@/lib/friendActivity";

// Types require both auth headers; the client middleware fills the real tokens.
const AUTH = { Authorization: "", refresh_token: "" };
const CATEGORY_STALE_MS = 30 * 60 * 1000;

export const categoryOptions = (id: string) =>
  $api.queryOptions("get", "/v1/categories/{id}", { params: { path: { id } } }, { staleTime: CATEGORY_STALE_MS });

// Task-scoped kudos need the category's name, but friends' tasks only carry its ID.
export function useResolveCategoryName(): (id?: string) => Promise<string> {
  const qc = useQueryClient();
  return useCallback(
    async (id?: string) => {
      if (!id) return "General";
      try {
        const category = await qc.fetchQuery(categoryOptions(id));
        return category?.name || "General";
      } catch {
        return "General";
      }
    },
    [qc]
  );
}

/** Quick one-tap nudge/congratulation sends to a friend, mirroring mobile's Friends page. */
export function useFriendSupport(friendId: string, recipientName: string) {
  const qc = useQueryClient();
  const { showRingUpdate } = useRingUpdate();
  const bump = useFriendshipBump();
  const { encouragementsLeft, congratulationsLeft, recordSent } = useKudosQuota();
  const resolveCategory = useResolveCategoryName();
  const encouragement = $api.useMutation("post", "/v1/user/encouragements");
  const congratulation = $api.useMutation("post", "/v1/user/congratulations");
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [sendingId, setSendingId] = useState<string | null>(null);

  const send = async (kind: SupportKind, option: FriendSupportOption): Promise<boolean> => {
    if (sendingId) return false;
    if (kind === "nudge" ? encouragementsLeft <= 0 : congratulationsLeft <= 0) {
      toast.warning(`You're out of ${kind === "nudge" ? "encouragements" : "congratulations"} for today.`);
      return false;
    }
    setSendingId(option.id);
    try {
      const categoryName = option.task ? await resolveCategory(option.task.categoryID) : "";
      const result =
        kind === "congratulate"
          ? await congratulation.mutateAsync({
              params: { header: AUTH },
              body: { receiver: friendId, message: option.message, categoryName, taskName: option.taskName ?? "", type: "message" },
            })
          : await encouragement.mutateAsync({
              params: { header: AUTH },
              body: option.task
                ? {
                    receiver: friendId,
                    message: option.message,
                    scope: "task",
                    categoryName,
                    taskName: option.task.content,
                    taskId: option.task.id,
                    type: "message",
                  }
                : { receiver: friendId, message: option.message, scope: "profile", type: "message" },
            });
      recordSent(kind === "nudge" ? "encouragement" : "congratulation");
      setSentIds((prev) => new Set(prev).add(`${kind}-${option.id}`));
      showRingUpdate(result?.ringDelta);
      qc.invalidateQueries({ queryKey: ["get", "/v1/user/rings/today"] });
      qc.invalidateQueries({ queryKey: friendProfileOptions(friendId).queryKey });
      bump(result?.friendshipDelta, recipientName);
      return true;
    } catch (error) {
      console.error("Quick kudos error:", error);
      toast.error("Couldn't send that. Try again.");
      return false;
    } finally {
      setSendingId(null);
    }
  };

  return { send, sendingId, isSent: (kind: SupportKind, id: string) => sentIds.has(`${kind}-${id}`) };
}
