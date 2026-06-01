import { useEffect, useState, useCallback } from "react";
import { request } from "@/hooks/useRequest";
import { createLogger } from "@/utils/logger";
import type { ForYouFeed, ForYouCardType } from "@/api/forYou";

const logger = createLogger("ForYou");

export type UseForYouResult = {
    feed: ForYouFeed | null;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    recordInteraction: (cardType: ForYouCardType) => Promise<void>;
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

    useEffect(() => {
        load();
    }, [load]);

    return { feed, loading, error, refresh: load, recordInteraction };
}
