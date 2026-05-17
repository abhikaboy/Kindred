import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getRingsToday, getRingsHistory, claimRingReward } from "@/api/rings";
import { RingState } from "@/api/types";

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
    const rings: RingState | null = todayData?.rings ?? null;
    const score = todayData?.score ?? 0;
    const allClosed = rings?.all_closed ?? false;
    const canClaimReward = allClosed && !(rings?.reward_claimed ?? false);

    return {
        rings,
        score,
        allClosed,
        canClaimReward,
        isLoading: isLoadingToday,
        history: historyData?.history ?? [],
        claimReward: claimRewardMutation.mutateAsync,
        isClaiming: claimRewardMutation.isPending,
        refetch,
    };
}
