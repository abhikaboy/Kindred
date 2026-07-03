import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getFriendsAPI } from "@/api/connection";

export type MentionCandidate = {
    id: string;
    handle: string;
    display_name: string;
    profile_picture?: string;
};

const EMPTY: MentionCandidate[] = [];

export const useFriendsForMention = () => {
    const { data, isPending } = useQuery({
        queryKey: ["friends", "mention"],
        queryFn: async () => {
            const list = await getFriendsAPI();
            return list.map((f: any) => ({
                id: f._id ?? f.id,
                handle: f.handle,
                display_name: f.display_name,
                profile_picture: f.profile_picture,
            })) as MentionCandidate[];
        },
    });

    const friends = data ?? EMPTY;

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

    return { friends, filter, loading: isPending };
};
