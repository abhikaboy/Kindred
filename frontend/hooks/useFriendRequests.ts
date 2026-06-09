import { useQuery } from "@tanstack/react-query";
import { getConnectionsByReceiverAPI } from "@/api/connection";

// Shared key so the nav badge and any request lists stay in sync; invalidate
// this after accepting/declining a request to refresh the count.
export const FRIEND_REQUESTS_KEY = ["connections", "received"] as const;

export const useFriendRequests = () =>
    useQuery({
        queryKey: FRIEND_REQUESTS_KEY,
        queryFn: getConnectionsByReceiverAPI,
        staleTime: 30_000,
        refetchOnWindowFocus: true,
    });

// Pending incoming friend-request count, for the search-tab nav badge.
export const useFriendRequestCount = (): number => {
    const { data } = useFriendRequests();
    return data?.length ?? 0;
};
