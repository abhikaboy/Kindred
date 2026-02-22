import client from "./client";
import { ERROR_MESSAGES } from "@/utils/errorParser";

export interface CalendarConnection {
    id: string;
    user_id: string;
    provider: "google" | "outlook" | "apple";
    provider_account_id: string;
    scopes: string[];
    is_primary: boolean;
    setup_complete: boolean;
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
    tasks_deleted?: number;
    events_total: number;
    workspace_name: string;
    categories_synced: Record<string, number>;
}

export interface CalendarInfo {
    id: string;
    name: string;
    description: string;
    is_primary: boolean;
    access_role: string;
}

export interface CalendarsResponse {
    calendars: CalendarInfo[];
}

/**
 * Get all calendar connections for the authenticated user
 */
export async function getCalendarConnections(): Promise<CalendarConnectionsResponse> {
    const response = await client.GET("/v1/user/calendar/connections" as any, {});

    if (response.error) {
        const error = new Error(response.error.detail || "Unable to load calendar connections");
        (error as any).status = response.error.status;
        (error as any).errors = response.error.errors;
        throw error;
    }

    return response.data as CalendarConnectionsResponse;
}

/**
 * Initiate Google Calendar OAuth flow
 */
export async function connectGoogleCalendar(): Promise<ConnectGoogleResponse> {
    const response = await client.GET("/v1/user/calendar/connect/google" as any, {});

    if (response.error) {
        const error = new Error(
            response.error.detail || ERROR_MESSAGES.CALENDAR_CONNECT_FAILED
        );
        (error as any).status = response.error.status;
        (error as any).errors = response.error.errors;
        throw error;
    }

    return response.data as ConnectGoogleResponse;
}

/**
 * Sync calendar events to tasks
 */
export async function syncCalendarEvents(
    connectionId: string,
    startDate?: string,
    endDate?: string
): Promise<SyncEventsResponse> {
    const response = await client.POST("/v1/user/calendar/connections/{connectionId}/sync" as any, {
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
        const error = new Error(
            response.error.detail || ERROR_MESSAGES.CALENDAR_SYNC_FAILED
        );
        (error as any).status = response.error.status;
        (error as any).errors = response.error.errors;
        throw error;
    }

    return response.data as SyncEventsResponse;
}

/**
 * Disconnect a calendar connection
 */
export async function disconnectCalendar(connectionId: string): Promise<{ success: boolean; message: string }> {
    const response = await client.DELETE("/v1/user/calendar/connections/{connectionId}" as any, {
        params: {
            path: {
                connectionId,
            },
        },
    });

    if (response.error) {
        const error = new Error(
            response.error.detail || ERROR_MESSAGES.CALENDAR_DISCONNECT_FAILED
        );
        (error as any).status = response.error.status;
        (error as any).errors = response.error.errors;
        throw error;
    }

    return response.data as { success: boolean; message: string };
}

/**
 * List all calendars available in a connected calendar account
 */
export async function getConnectionCalendars(connectionId: string): Promise<CalendarsResponse> {
    const response = await client.GET("/v1/user/calendar/connections/{connectionId}/calendars" as any, {
        params: {
            path: { connectionId },
        },
    });

    if (response.error) {
        const error = new Error(response.error.detail || "Unable to list calendars");
        (error as any).status = response.error.status;
        (error as any).errors = response.error.errors;
        throw error;
    }

    return response.data as CalendarsResponse;
}

/**
 * Set up workspaces/categories for the user's chosen calendars
 */
export async function setupCalendarWorkspaces(
    connectionId: string,
    calendarIds: string[],
    mergeIntoOne: boolean
): Promise<{ success: boolean; message: string }> {
    const response = await client.POST("/v1/user/calendar/connections/{connectionId}/setup" as any, {
        params: {
            path: { connectionId },
        },
        body: {
            calendar_ids: calendarIds,
            merge_into_one: mergeIntoOne,
        },
    });

    if (response.error) {
        const error = new Error(response.error.detail || "Unable to set up calendar workspaces");
        (error as any).status = response.error.status;
        (error as any).errors = response.error.errors;
        throw error;
    }

    return response.data as { success: boolean; message: string };
}

/**
 * Get calendar events (without syncing to tasks)
 */
export async function getCalendarEvents(
    connectionId: string,
    startDate?: string,
    endDate?: string
) {
    const response = await client.GET("/v1/user/calendar/connections/{connectionId}/events" as any, {
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
        const error = new Error(
            response.error.detail || "Unable to fetch calendar events"
        );
        (error as any).status = response.error.status;
        (error as any).errors = response.error.errors;
        throw error;
    }

    return response.data;
}
