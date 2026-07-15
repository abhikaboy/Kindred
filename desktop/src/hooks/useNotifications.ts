import { useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { $api } from "@/lib/api/query";
import type { components } from "@/lib/api/types.gen";

export type NotificationDocument = components["schemas"]["NotificationDocument"];
export type ConnectionDocument = components["schemas"]["ConnectionDocument"];

type GetNotificationsOutputBody =
  components["schemas"]["GetNotificationsOutputBody"];

// Types require both auth headers; the client middleware fills the real tokens.
const AUTH = { Authorization: "", refresh_token: "" };

// Unwraps GetNotificationsOutputBody via `select`, then exposes the array + unread count.
export function useNotifications(): {
  notifications: NotificationDocument[];
  unreadCount: number;
  isLoading: boolean;
  error: unknown;
} {
  const { data, isLoading, error } = $api.useQuery(
    "get",
    "/v1/user/notifications",
    { params: { header: AUTH } },
    { select: (body: GetNotificationsOutputBody) => body }
  );
  return {
    notifications: data?.notifications ?? [],
    unreadCount: data?.unread_count ?? 0,
    isLoading,
    error,
  };
}

// PATCH read-all; invalidates the notifications query onSuccess. Raw mutation.
export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return $api.useMutation("patch", "/v1/user/notifications/read-all", {
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["get", "/v1/user/notifications"] }),
  });
}

export function useFollowRequests(): UseQueryResult<ConnectionDocument[]> {
  return $api.useQuery("get", "/v1/user/connections/received", {
    params: { header: AUTH },
  }) as UseQueryResult<ConnectionDocument[]>;
}

// POST accept — invalidates /connections/received onSuccess. Raw mutation.
export function useAcceptConnection() {
  const qc = useQueryClient();
  return $api.useMutation("post", "/v1/user/connections/{id}/accept", {
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ["get", "/v1/user/connections/received"],
      }),
  });
}

// DELETE deny — invalidates /connections/received onSuccess. Raw mutation.
export function useDenyConnection() {
  const qc = useQueryClient();
  return $api.useMutation("delete", "/v1/user/connections/{id}", {
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ["get", "/v1/user/connections/received"],
      }),
  });
}
