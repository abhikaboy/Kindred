import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import client from "@/lib/api/client";
import type { components } from "@/lib/api/types.gen";

export type CalendarConnection = components["schemas"]["CalendarConnection"];
export type CalendarInfo = components["schemas"]["CalendarInfo"];

// The calendar endpoints don't declare an Authorization header param in the
// OpenAPI schema; the client middleware injects the Bearer token automatically.

// Task query keys invalidated after sync so imported events land on the grid.
const TASK_QUERY_KEYS = [
  ["get", "/v1/user/workspaces"],
  ["get", "/v1/tasks/"],
] as const;

export function useCalendarConnections(): {
  connections: CalendarConnection[];
  isLoading: boolean;
  refetch: () => void;
} {
  const query = useQuery({
    queryKey: ["calendarConnections"],
    queryFn: async () => {
      const { data, error } = await client.GET("/v1/user/calendar/connections", {});
      if (error) throw error;
      return data;
    },
  });

  return {
    connections: query.data?.connections ?? [],
    isLoading: query.isLoading,
    refetch: () => { void query.refetch(); },
  };
}

export function useConnectionCalendars(connectionId: string | null): {
  calendars: CalendarInfo[];
  isLoading: boolean;
} {
  const query = useQuery({
    queryKey: ["connectionCalendars", connectionId],
    enabled: connectionId !== null,
    queryFn: async () => {
      const { data, error } = await client.GET(
        "/v1/user/calendar/connections/{connectionId}/calendars",
        { params: { path: { connectionId: connectionId! } } }
      );
      if (error) throw error;
      return data;
    },
  });

  return {
    calendars: query.data?.calendars ?? [],
    isLoading: query.isLoading,
  };
}

export function useConnectGoogle(): {
  mutateAsync: () => Promise<{ auth_url: string }>;
  isPending: boolean;
} {
  const mut = useMutation({
    mutationFn: async () => {
      const { data, error } = await client.GET("/v1/user/calendar/connect/google", {});
      if (error) throw error;
      return data as { auth_url: string };
    },
  });
  return { mutateAsync: mut.mutateAsync, isPending: mut.isPending };
}

export function useSetupCalendar(): {
  mutateAsync: (v: {
    connectionId: string;
    calendarIds: string[];
    pushEnabledCalendarIds: string[];
    mergeIntoOne: boolean;
    makePublic: boolean;
  }) => Promise<unknown>;
  isPending: boolean;
} {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: async ({
      connectionId,
      calendarIds,
      pushEnabledCalendarIds,
      mergeIntoOne,
      makePublic,
    }: {
      connectionId: string;
      calendarIds: string[];
      pushEnabledCalendarIds: string[];
      mergeIntoOne: boolean;
      makePublic: boolean;
    }) => {
      const { data, error } = await client.POST(
        "/v1/user/calendar/connections/{connectionId}/setup",
        {
          params: { path: { connectionId } },
          body: {
            calendar_ids: calendarIds,
            push_enabled_calendar_ids: pushEnabledCalendarIds,
            merge_into_one: mergeIntoOne,
            make_public: makePublic,
          },
        }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["calendarConnections"] });
    },
  });
  return { mutateAsync: mut.mutateAsync, isPending: mut.isPending };
}

export function useSyncCalendar(): {
  mutateAsync: (v: { connectionId: string }) => Promise<{
    tasks_created: number;
    tasks_skipped: number;
    events_total: number;
    workspace_name: string;
  }>;
  isPending: boolean;
} {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: async ({ connectionId }: { connectionId: string }) => {
      const { data, error } = await client.POST(
        "/v1/user/calendar/connections/{connectionId}/sync",
        { params: { path: { connectionId } } }
      );
      if (error) throw error;
      return data as {
        tasks_created: number;
        tasks_skipped: number;
        events_total: number;
        workspace_name: string;
      };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["calendarConnections"] });
      for (const key of TASK_QUERY_KEYS) {
        void qc.invalidateQueries({ queryKey: key });
      }
    },
  });
  return { mutateAsync: mut.mutateAsync, isPending: mut.isPending };
}

export function useDisconnectCalendar(): {
  mutateAsync: (v: { connectionId: string }) => Promise<unknown>;
  isPending: boolean;
} {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: async ({ connectionId }: { connectionId: string }) => {
      const { data, error } = await client.DELETE(
        "/v1/user/calendar/connections/{connectionId}",
        { params: { path: { connectionId } } }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["calendarConnections"] });
    },
  });
  return { mutateAsync: mut.mutateAsync, isPending: mut.isPending };
}

// Polls GET /v1/user/calendar/connections until a connection appears whose id is
// not in knownIds (i.e. a freshly created pending connection). Returns null on timeout.
export function pollForNewConnection(
  knownIds: Set<string>,
  opts?: { intervalMs?: number; maxAttempts?: number }
): Promise<CalendarConnection | null> {
  const intervalMs = opts?.intervalMs ?? 3000;
  const maxAttempts = opts?.maxAttempts ?? 40;

  return new Promise((resolve) => {
    let attempts = 0;

    const tick = async () => {
      attempts += 1;
      const { data } = await client.GET("/v1/user/calendar/connections", {});
      const found = (data?.connections ?? []).find((c) => !knownIds.has(c.id));
      if (found) {
        resolve(found);
        return;
      }
      if (attempts >= maxAttempts) {
        resolve(null);
        return;
      }
      setTimeout(() => { void tick(); }, intervalMs);
    };

    void tick();
  });
}
