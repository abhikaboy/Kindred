import { useEffect, useState, useCallback } from "react";
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
    const [feed, setFeed] = useState<ForYouFeed | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await request("GET", "/user/for-you");
            setFeed(response as ForYouFeed);
        } catch (e) {
            logger.error("Failed to load For You feed", e);
            setError(e instanceof Error ? e.message : "Failed to load For You");
        } finally {
            setLoading(false);
        }
    }, []);

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
    const dismissCard = useCallback((cardId: string) => {
        setFeed((prev) => (prev ? dismissCardFromFeed(prev, cardId) : prev));
        request("POST", "/user/for-you/dismiss", { cardId }).catch((e) => {
            logger.warn("Failed to dismiss For You card", e);
        });
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    return { feed, loading, error, refresh: load, recordInteraction, dismissCard };
}
