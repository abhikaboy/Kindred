import { useEffect, useState, useCallback } from "react";
import type { ForYouFeed } from "@/api/forYou";

// TODO(backend Phase 2): replace stub with real `GET /for-you` call.
// Backend contract is documented in docs/superpowers/specs/2026-05-31-for-you-tab-design.md.
const STUB_FEED: ForYouFeed = {
    unreadCount: 3,
    sections: [
        {
            id: "catch_up",
            title: "Catch up",
            cards: [
                {
                    id: "stub-kudos-1",
                    type: "kudos_received",
                    displayMode: "full",
                    iconKind: "kudos",
                    title: "Sarah sent you a kudos!",
                    body: "Kudos are a quick way to celebrate friends' wins.",
                    subject: { userId: "stub-user-sarah", displayName: "Sarah" },
                    ctas: [
                        {
                            label: "Send one back",
                            kind: "primary",
                            action: { type: "send_kudos", targetUserId: "stub-user-sarah" },
                        },
                        {
                            label: "Reply",
                            kind: "secondary",
                            action: { type: "navigate", href: "/(logged-in)/(tabs)/(task)/kudos" },
                        },
                    ],
                    deepLink: "/(logged-in)/(tabs)/(task)/kudos",
                    priority: 100,
                },
                {
                    id: "stub-reciprocity-1",
                    type: "reciprocity_encourage",
                    displayMode: "full",
                    iconKind: "users",
                    title: "Mike just finished his morning routine",
                    body: "Encourage him?",
                    subject: { userId: "stub-user-mike", displayName: "Mike" },
                    ctas: [
                        {
                            label: "Send encouragement",
                            kind: "primary",
                            action: {
                                type: "send_encouragement",
                                targetUserId: "stub-user-mike",
                                taskId: "stub-task-routine",
                            },
                        },
                    ],
                    deepLink: "/(logged-in)/(tabs)/(task)/kudos",
                    priority: 80,
                },
                {
                    id: "stub-kudos-2",
                    type: "kudos_received",
                    displayMode: "compact",
                    iconKind: "kudos",
                    title: "Jordan sent you a kudos",
                    subject: { userId: "stub-user-jordan", displayName: "Jordan" },
                    ctas: [
                        {
                            label: "Send back",
                            kind: "primary",
                            action: { type: "send_kudos", targetUserId: "stub-user-jordan" },
                        },
                    ],
                    deepLink: "/(logged-in)/(tabs)/(task)/kudos",
                    priority: 60,
                },
            ],
        },
        {
            id: "suggested",
            title: "Suggested for you",
            cards: [
                {
                    id: "stub-ring-1",
                    type: "ring_progress",
                    displayMode: "full",
                    iconKind: "ring",
                    title: "One task away from closing today's ring",
                    body: "Rings track how much of your day you've completed.",
                    ctas: [
                        {
                            label: "Go to today's tasks",
                            kind: "primary",
                            action: { type: "navigate", href: "/(logged-in)/(tabs)/(task)/daily" },
                        },
                    ],
                    deepLink: "/(logged-in)/(tabs)/(task)/daily",
                    priority: 90,
                },
                {
                    id: "stub-post-1",
                    type: "post_prompt",
                    displayMode: "full",
                    iconKind: "post",
                    title: "Share something with your circle",
                    body: "Posts let your friends cheer you on.",
                    ctas: [
                        {
                            label: "Share a post",
                            kind: "primary",
                            action: { type: "navigate", href: "/(logged-in)/(tabs)/(feed)/feed" },
                        },
                    ],
                    deepLink: "/(logged-in)/(tabs)/(feed)/feed",
                    priority: 70,
                },
            ],
        },
    ],
};

export type UseForYouResult = {
    feed: ForYouFeed | null;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
};

export function useForYou(): UseForYouResult {
    const [feed, setFeed] = useState<ForYouFeed | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // TODO(backend Phase 2): swap for real fetch.
            await new Promise((r) => setTimeout(r, 150));
            setFeed(STUB_FEED);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load For You");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    return { feed, loading, error, refresh: load };
}
