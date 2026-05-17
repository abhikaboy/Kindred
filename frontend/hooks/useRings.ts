import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getRingsToday, getRingsHistory, claimRingReward } from "@/api/rings";
import { RingState } from "@/api/types";
import { showToast } from "@/utils/showToast";

export function useRings() {
    const queryClient = useQueryClient();

    // Query for today's ring state
    const {
        data: todayData,
        isLoading: isLoadingToday,
        refetch,
    } = useQuery({
        queryKey: ["rings", "today"],
        queryFn: getRingsToday,
        staleTime: 60_000, // 60 seconds
        refetchInterval: 5 * 60_000, // 5 minutes
    });

    // Query for ring history
    const {
        data: historyData,
        isLoading: isLoadingHistory,
    } = useQuery({
        queryKey: ["rings", "history"],
        queryFn: () => getRingsHistory(),
        staleTime: 5 * 60_000, // 5 minutes
    });

    // Mutation for claiming reward
    const claimRewardMutation = useMutation({
        mutationFn: claimRingReward,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["rings", "today"] });
            queryClient.invalidateQueries({ queryKey: ["rings", "history"] });
        },
    });

    // Derived state
    const rings: RingState | null = todayData?.ring_state ?? null;
    const score = todayData?.productivity_score ?? 0;
    const streak = todayData?.current_streak ?? 0;
    const allClosed = rings?.all_closed ?? false;
    const canClaimReward = todayData?.reward_available ?? false;

    // Auto-claim reward when all rings close
    const claimedRef = useRef(false);

    useEffect(() => {
        if (!canClaimReward) {
            // Reset ref when reward is no longer claimable (new day)
            claimedRef.current = false;
            return;
        }

        if (claimedRef.current) return;
        claimedRef.current = true;

        claimRewardMutation.mutateAsync().then((result) => {
            if (result.claimed && result.credit_type && result.amount) {
                const friendlyType =
                    result.credit_type === "naturalLanguage"
                        ? "Natural Language"
                        : result.credit_type.charAt(0).toUpperCase() +
                          result.credit_type.slice(1);

                showToast(
                    `All rings closed! +${result.amount} ${friendlyType} Credit(s)`,
                    "success",
                    "Reward Claimed"
                );
            }
        }).catch(() => {
            // Allow retry on failure
            claimedRef.current = false;
        });
    }, [canClaimReward]);

    return {
        rings,
        score,
        streak,
        allClosed,
        canClaimReward,
        isLoading: isLoadingToday,
        history: historyData?.history ?? [],
        claimReward: claimRewardMutation.mutateAsync,
        isClaiming: claimRewardMutation.isPending,
        refetch,
    };
}
