import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getRingsToday, getRingsHistory, claimRingReward } from "@/api/rings";
import { RingState } from "@/api/types";

export function useRings() {
    const queryClient = useQueryClient();

    const {
        data: todayData,
        isLoading: isLoadingToday,
        refetch,
    } = useQuery({
        queryKey: ["rings", "today"],
        queryFn: getRingsToday,
        staleTime: 60_000,
        refetchInterval: 5 * 60_000,
    });

    const {
        data: historyData,
        isLoading: isLoadingHistory,
    } = useQuery({
        queryKey: ["rings", "history"],
        queryFn: () => getRingsHistory(),
        staleTime: 5 * 60_000,
    });

    const claimRewardMutation = useMutation({
        mutationFn: claimRingReward,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["rings", "today"] });
            queryClient.invalidateQueries({ queryKey: ["rings", "history"] });
        },
    });

    const rings: RingState | null = todayData?.ring_state ?? null;
    const score = todayData?.productivity_score ?? 0;
    const streak = todayData?.current_streak ?? 0;
    const allClosed = rings?.all_closed ?? false;
    const canClaimReward = todayData?.reward_available ?? false;

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
