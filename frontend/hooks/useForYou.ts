import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "@/hooks/useRequest";
import { createLogger } from "@/utils/logger";
import { dismissCardFromFeed, type ForYouFeed, type ForYouCardType } from "@/api/forYou";

const logger = createLogger("ForYou");

export type UseForYouResult = {
    feed: ForYouFeed | null;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    recordInteraction: (cardType: ForYouCardType) => Promise<void>;
    dismissCard: (cardId: string) => void;
};

export function useForYou(): UseForYouResult {
    const queryClient = useQueryClient();

    const { data, isPending, error, refetch } = useQuery({
        queryKey: ["forYou"],
        queryFn: async () => (await request("GET", "/user/for-you")) as ForYouFeed,
    });

    if (error) {
        logger.error("Failed to load For You feed", error);
    }

    const refresh = useCallback(async () => {
        await refetch();
    }, [refetch]);

    const recordInteraction = useCallback(async (cardType: ForYouCardType) => {
        try {
            await request("POST", "/user/for-you/interactions", { cardType });
        } catch (e) {
            logger.warn("Failed to record For You interaction", e);
        }
    }, []);

    // Optimistically remove the card, then persist the dismissal so it stays
    // gone across refreshes. Fire-and-forget — the local removal is what the
    // user sees; a failed request just means it may reappear next refresh.
    const dismissCard = useCallback(
        (cardId: string) => {
            queryClient.setQueryData<ForYouFeed>(["forYou"], (prev) =>
                prev ? dismissCardFromFeed(prev, cardId) : prev
            );
            request("POST", "/user/for-you/dismiss", { cardId }).catch((e) => {
                logger.warn("Failed to dismiss For You card", e);
            });
        },
        [queryClient]
    );

    return {
        feed: data ?? null,
        loading: isPending,
        error: error ? (error instanceof Error ? error.message : "Failed to load For You") : null,
        refresh,
        recordInteraction,
        dismissCard,
    };
}
