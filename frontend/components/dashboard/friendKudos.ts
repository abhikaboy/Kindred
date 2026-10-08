import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircleIcon, CircleIcon, HandWavingIcon, LightningIcon, TrophyIcon } from "phosphor-react-native";
import { getCategoryById } from "@/api/category";
import { RING_ENCOURAGE_MESSAGES, type RingKey } from "@/components/profile/ProductivityRings";
import { RING_COLORS } from "@shared/rings";
import { createEncouragementAPI } from "@/api/encouragement";
import { createCongratulationAPI } from "@/api/congratulation";
import { useAuth } from "@/hooks/useAuth";
import { useUserKudos } from "@/hooks/useUserKudos";
import { showToast } from "@/utils/showToast";
import { hapticCompletionBurst, hapticLight } from "@/utils/haptics";
import { useRingUpdate } from "@/contexts/ringUpdateContext";
import { useKudosSent } from "@/contexts/kudosSentContext";
import type { components } from "@/api/generated/types";

export type Friend = components["schemas"]["UserExtendedReference"];
export type Profile = components["schemas"]["FriendActivity"];
export type TaskDocument = components["schemas"]["TaskDocument"];

export const ACTIVITY_STALE_MS = 5 * 60 * 1000;
export const LIVE_DOT_COLOR = "#34C759";
export const RING_KEYS: RingKey[] = ["plan", "do", "share"];

export type Activity =
    | { kind: "working"; task: TaskDocument; since?: string }
    | { kind: "finished"; task: TaskDocument; since?: string }
    | { kind: "idle" };

export function isToday(iso?: string) {
    return !!iso && new Date(iso).toDateString() === new Date().toDateString();
}

export function shortElapsed(iso?: string) {
    if (!iso) return "";
    const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h`;
}

export function getActivity(profile?: Profile): Activity {
    const working = (profile?.tasks ?? []).find((t) => t.workingOnSince || t.active);
    if (working) return { kind: "working", task: working, since: working.workingOnSince ?? working.startedAt };
    const finished = (profile?.completed_tasks ?? [])
        .filter((t) => isToday(t.timeCompleted))
        .sort((a, b) => (b.timeCompleted ?? "").localeCompare(a.timeCompleted ?? ""))[0];
    if (finished) return { kind: "finished", task: finished, since: finished.timeCompleted };
    return { kind: "idle" };
}

export const ACTIVITY_RANK: Record<Activity["kind"], number> = { working: 0, finished: 1, idle: 2 };
// Idle friends get no heading; they simply follow the active ones.
export const SECTION_TITLES: Record<Activity["kind"], string | null> = { working: "Active now", finished: "Earlier today", idle: null };

export const RING_NAMES: Record<RingKey, string> = { plan: "Plan", do: "Do", share: "Share" };
export const RING_NUDGE_LABELS: Record<RingKey, string> = {
    plan: "Plan their day",
    do: "Get their tasks done",
    share: "Share something",
};

export type SupportKind = "nudge" | "congratulate";
export type SupportOption = {
    id: string;
    label: string;
    message: string;
    color: string;
    Icon: typeof HandWavingIcon;
    // encouragement (nudge) or congratulation, optionally tied to a task
    task?: TaskDocument;
    taskName?: string;
};

export function buildOptions(kind: SupportKind, profile: Profile | undefined, primary: string): SupportOption[] {
    const rings = profile?.ring_state;
    const options: SupportOption[] = [];
    if (kind === "nudge") {
        const tasks = (profile?.tasks ?? []).filter((t) => !t.timeCompleted);
        const working = tasks.filter((t) => t.workingOnSince || t.active);
        const pending = tasks.filter((t) => !(t.workingOnSince || t.active));
        working.slice(0, 2).forEach((task) =>
            options.push({ id: `task-${task.id}`, label: `Keep going on ${task.content}`, message: "You've got this, keep going!", color: primary, Icon: LightningIcon, task })
        );
        pending.slice(0, 2).forEach((task) =>
            options.push({ id: `task-${task.id}`, label: `Finish ${task.content}`, message: "Go knock this one out!", color: primary, Icon: CheckCircleIcon, task })
        );
        if (rings)
            RING_KEYS.filter((k) => !rings[k].closed).forEach((k) =>
                options.push({ id: `ring-${k}`, label: RING_NUDGE_LABELS[k], message: RING_ENCOURAGE_MESSAGES[k], color: RING_COLORS[k], Icon: CircleIcon })
            );
    } else {
        (profile?.completed_tasks ?? [])
            .filter((t) => isToday(t.timeCompleted))
            .slice(0, 3)
            .forEach((task) =>
                options.push({ id: `task-${task.id}`, label: `Finishing ${task.content}`, message: "Nice work getting that done!", color: primary, Icon: CheckCircleIcon, task, taskName: task.content })
            );
        if (rings?.all_closed)
            options.push({ id: "ring-all", label: "Closing every ring", message: "Every ring closed today. Incredible!", color: primary, Icon: TrophyIcon, taskName: "Closing every ring" });
        else if (rings)
            RING_KEYS.filter((k) => rings[k].closed).forEach((k) =>
                options.push({ id: `ring-${k}`, label: `Closing their ${RING_NAMES[k]} ring`, message: `Way to close your ${RING_NAMES[k]} ring!`, color: RING_COLORS[k], Icon: CircleIcon, taskName: `${RING_NAMES[k]} ring` })
            );
    }
    return options;
}

export const CATEGORY_STALE_MS = 30 * 60 * 1000;
// Task-scoped kudos require the category's name, but friends' tasks only carry its ID.
export function useCategoryName(categoryId?: string) {
    const queryClient = useQueryClient();
    const { data } = useQuery({
        queryKey: ["category", categoryId],
        queryFn: () => getCategoryById(categoryId!),
        enabled: !!categoryId,
        staleTime: CATEGORY_STALE_MS,
    });
    const resolve = useCallback(
        async (id?: string) => {
            if (!id) return "General";
            try {
                const category = await queryClient.fetchQuery({
                    queryKey: ["category", id],
                    queryFn: () => getCategoryById(id),
                    staleTime: CATEGORY_STALE_MS,
                });
                return category.name || "General";
            } catch {
                return "General";
            }
        },
        [queryClient]
    );
    return { name: data?.name, resolve };
}


// Sends a one-tap kudos and plays the shared sent / ring-update feedback.
export function useQuickKudos(friend: Friend) {
    const { updateUser } = useAuth();
    const queryClient = useQueryClient();
    const { showRingUpdate } = useRingUpdate();
    const { showKudosSent } = useKudosSent();
    const { encouragementsLeft, congratulationsLeft, currentKudosRewards } = useUserKudos();
    const [sentIds, setSentIds] = useState<Set<string>>(new Set());
    const [sendingId, setSendingId] = useState<string | null>(null);
    const { resolve: resolveCategory } = useCategoryName();
    const firstName = friend.display_name.split(" ")[0];

    const send = async (kind: SupportKind, option: SupportOption): Promise<boolean> => {
        if (sendingId) return false;
        if (kind === "nudge" ? encouragementsLeft <= 0 : congratulationsLeft <= 0) {
            showToast(`You're out of ${kind === "nudge" ? "encouragements" : "congratulations"} for today.`, "warning");
            return false;
        }
        hapticLight();
        setSendingId(option.id);
        try {
            const categoryName = option.task ? await resolveCategory(option.task.categoryID) : "";
            let result: Awaited<ReturnType<typeof createEncouragementAPI | typeof createCongratulationAPI>>;
            if (kind === "congratulate") {
                result = await createCongratulationAPI({
                    receiver: friend._id,
                    message: option.message,
                    categoryName,
                    taskName: option.taskName ?? "",
                    type: "message",
                });
                updateUser({
                    congratulations: Math.max(0, congratulationsLeft - 1),
                    kudosRewards: { ...currentKudosRewards, congratulations: currentKudosRewards.congratulations + 1 },
                });
            } else {
                result = await createEncouragementAPI(
                    option.task
                        ? {
                              receiver: friend._id,
                              message: option.message,
                              scope: "task",
                              categoryName,
                              taskName: option.task.content,
                              taskId: option.task.id,
                              type: "message",
                          }
                        : { receiver: friend._id, message: option.message, scope: "profile", type: "message" }
                );
                updateUser({
                    encouragements: Math.max(0, encouragementsLeft - 1),
                    kudosRewards: { ...currentKudosRewards, encouragements: currentKudosRewards.encouragements + 1 },
                });
            }
            hapticCompletionBurst();
            setSentIds((prev) => new Set(prev).add(`${kind}-${option.id}`));
            showRingUpdate(result?.ringDelta);
            queryClient.invalidateQueries({ queryKey: ["rings", "today"] });
            if (result?.friendshipDelta) queryClient.invalidateQueries({ queryKey: ["profile", friend._id] });
            showKudosSent({
                recipientName: friend.handle || firstName,
                message: option.message,
                kind: kind === "nudge" ? "encouragement" : "congratulation",
                taskName: option.task?.content ?? option.taskName,
                friendship: result?.friendshipDelta,
            });
            return true;
        } catch (error) {
            console.error("Quick kudos error:", error);
            showToast("Couldn't send that. Try again.", "danger");
            return false;
        } finally {
            setSendingId(null);
        }
    };


    return { send, sendingId, sentIds };
}
