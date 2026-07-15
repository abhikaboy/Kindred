import { useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { $api } from "@/lib/api/query";
import type { components } from "@/lib/api/types.gen";

export type ProfileDocument = components["schemas"]["ProfileDocument"];
export type FriendReference = components["schemas"]["FriendReference"];
export type ConnectionDocument = components["schemas"]["ConnectionDocument"];
export type UserExtendedReference = components["schemas"]["UserExtendedReference"];

// All /v1/user/* ops require both auth headers; the client middleware fills the real tokens.
const AUTH = { Authorization: "", refresh_token: "" };

const FRIENDS_KEY = ["get", "/v1/user/connections/friends"];
const RECEIVED_KEY = ["get", "/v1/user/connections/received"];

export function useFriends(): UseQueryResult<FriendReference[]> {
  return $api.useQuery("get", "/v1/user/connections/friends", {
    params: { header: AUTH },
  }) as UseQueryResult<FriendReference[]>;
}

export function useReceivedRequests(): UseQueryResult<ConnectionDocument[]> {
  return $api.useQuery("get", "/v1/user/connections/received", {
    params: { header: AUTH },
  }) as UseQueryResult<ConnectionDocument[]>;
}

// Query is only issued when non-empty; server query param is `query`.
export function useProfileSearch(query: string): UseQueryResult<ProfileDocument[]> {
  return $api.useQuery(
    "get",
    "/v1/user/profiles/search",
    { params: { header: AUTH, query: { query } } },
    { enabled: query.trim().length > 0 }
  ) as UseQueryResult<ProfileDocument[]>;
}

export function useSuggestedUsers(): UseQueryResult<UserExtendedReference[]> {
  return $api.useQuery("get", "/v1/profiles/suggested", {
    params: { header: AUTH },
  }) as UseQueryResult<UserExtendedReference[]>;
}

// POST accept — refreshes friends + received lists.
export function useAcceptRequest() {
  const qc = useQueryClient();
  return $api.useMutation("post", "/v1/user/connections/{id}/accept", {
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FRIENDS_KEY });
      qc.invalidateQueries({ queryKey: RECEIVED_KEY });
    },
  });
}

// POST create — refreshes received (and friends, in case of auto-accept back-follow).
export function useSendRequest() {
  const qc = useQueryClient();
  return $api.useMutation("post", "/v1/user/connections", {
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FRIENDS_KEY });
      qc.invalidateQueries({ queryKey: RECEIVED_KEY });
    },
  });
}

// DELETE — remove a friend / decline / cancel a request; refreshes both lists.
export function useRemoveConnection() {
  const qc = useQueryClient();
  return $api.useMutation("delete", "/v1/user/connections/{id}", {
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FRIENDS_KEY });
      qc.invalidateQueries({ queryKey: RECEIVED_KEY });
    },
  });
}
