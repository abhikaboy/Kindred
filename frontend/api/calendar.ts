import client from "./client";

export interface CalendarConnection {
    id: string;
    user_id: string;
    provider: "google" | "outlook" | "apple";
    provider_account_id: string;
    scopes: string[];
    is_primary: boolean;
    last_sync: string;
    created_at: string;
    updated_at: string;
}

export interface CalendarConnectionsResponse {
    connections: CalendarConnection[];
}

export interface ConnectGoogleResponse {
    auth_url: string;
}

export interface SyncEventsResponse {
    tasks_created: number;
    tasks_skipped: number;
    events_total: number;
    workspace_name: string;
    categories_synced: Record<string, number>;
}

/**
 * Get all calendar connections for the authenticated user
 */
export async function getCalendarConnections(): Promise<CalendarConnectionsResponse> {
    const response = await client.GET("/v1/user/calendar/connections");

    if (response.error) {
        throw new Error(response.error.detail || "Failed to fetch calendar connections");
    }

    return response.data as CalendarConnectionsResponse;
}

/**
 * Initiate Google Calendar OAuth flow
 */
export async function connectGoogleCalendar(): Promise<ConnectGoogleResponse> {
    const response = await client.GET("/v1/user/calendar/connect/google");

    if (response.error) {
        throw new Error(response.error.detail || "Failed to initiate Google Calendar connection");
    }

    return response.data as ConnectGoogleResponse;
}

/**
 * Disconnect a calendar connection
 */
export async function disconnectCalendar(connectionId: string): Promise<void> {
    const response = await client.DELETE("/v1/user/calendar/connections/{connectionId}", {
        params: {
            path: {
                connectionId,
            },
        },
    });

    if (response.error) {
        throw new Error(response.error.detail || "Failed to disconnect calendar");
    }
}

/**
 * Sync calendar events to tasks
 */
export async function syncCalendarEvents(
    connectionId: string,
    startDate?: string,
    endDate?: string
): Promise<SyncEventsResponse> {
    const response = await client.POST("/v1/user/calendar/connections/{connectionId}/sync", {
        params: {
            path: {
                connectionId,
            },
            query: {
                start: startDate,
                end: endDate,
            },
        },
    });

    if (response.error) {
        throw new Error(response.error.detail || "Failed to sync calendar events");
    }

    return response.data as SyncEventsResponse;
}

/**
 * Get calendar events (without syncing to tasks)
 */
export async function getCalendarEvents(
    connectionId: string,
    startDate?: string,
    endDate?: string
) {
    const response = await client.GET("/v1/user/calendar/connections/{connectionId}/events", {
        params: {
            path: {
                connectionId,
            },
            query: {
                start: startDate,
                end: endDate,
            },
        },
    });

    if (response.error) {
        throw new Error(response.error.detail || "Failed to fetch calendar events");
    }

    return response.data;
}
