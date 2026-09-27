import { useQueries } from "@tanstack/react-query";
import { $api } from "@/lib/api/query";
import type { FriendProfile } from "@/lib/friendActivity";

const PROFILE_STALE_MS = 5 * 60 * 1000;

export const friendProfileOptions = (id: string) =>
  $api.queryOptions("get", "/v1/user/profiles/{id}", { params: { path: { id } } }, { staleTime: PROFILE_STALE_MS });

// One profile request per friend (same cache entry as the account page), for rings and tasks.
export function useFriendProfiles(ids: string[]): { profiles: (FriendProfile | undefined)[]; isLoading: boolean } {
  const results = useQueries({ queries: ids.map((id) => friendProfileOptions(id)) });
  return {
    profiles: results.map((r) => r.data as FriendProfile | undefined),
    isLoading: results.some((r) => r.isLoading),
  };
}
