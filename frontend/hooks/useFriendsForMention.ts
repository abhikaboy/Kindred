import { useEffect, useMemo, useState } from "react";
import { getFriendsAPI } from "@/api/connection";

export type MentionCandidate = {
    id: string;
    handle: string;
    display_name: string;
    profile_picture?: string;
};

export const useFriendsForMention = () => {
    const [friends, setFriends] = useState<MentionCandidate[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const list = await getFriendsAPI();
                if (cancelled) return;
                setFriends(
                    list.map((f: any) => ({
                        id: f._id ?? f.id,
                        handle: f.handle,
                        display_name: f.display_name,
                        profile_picture: f.profile_picture,
                    })),
                );
            } catch (e) {
                console.warn("useFriendsForMention: failed to load friends", e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const filter = useMemo(
        () => (query: string) => {
            const q = query.trim().toLowerCase();
            if (!q) return friends;
            return friends.filter(
                (f) =>
                    f.handle.toLowerCase().startsWith(q) ||
                    f.display_name.toLowerCase().includes(q),
            );
        },
        [friends],
    );

    return { friends, filter, loading };
};
