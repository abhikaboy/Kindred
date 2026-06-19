import client from "./client";
import { withAuthHeaders } from "./utils";
import { createLogger } from "@/utils/logger";
import { components } from "./generated/types";

const logger = createLogger("AnalyticsAPI");

// Widget-ready dashboard payload, generated from the backend OpenAPI spec.
export type AnalyticsResponse = components["schemas"]["AnalyticsResponse"];
export type AnalyticsSignal = components["schemas"]["AnalyticsSignal"];
export type AnalyticsSignals = components["schemas"]["AnalyticsSignals"];
export type AnalyticsProgress = components["schemas"]["AnalyticsProgress"];
export type AnalyticsProgressBucket = components["schemas"]["AnalyticsProgressBucket"];
export type AnalyticsProgressSegment = components["schemas"]["AnalyticsProgressSegment"];
export type AnalyticsLegendItem = components["schemas"]["AnalyticsLegendItem"];
export type AnalyticsCategoryShare = components["schemas"]["AnalyticsCategoryShare"];
export type AnalyticsShareSlice = components["schemas"]["AnalyticsShareSlice"];
export type AnalyticsShareBand = components["schemas"]["AnalyticsShareBand"];
export type AnalyticsHeatmap = components["schemas"]["AnalyticsHeatmap"];
export type AnalyticsHeatmapDay = components["schemas"]["AnalyticsHeatmapDay"];
export type AnalyticsHabits = components["schemas"]["AnalyticsHabits"];
export type AnalyticsHabitRow = components["schemas"]["AnalyticsHabitRow"];
export type AnalyticsCategoryHealth = components["schemas"]["AnalyticsCategoryHealth"];
export type AnalyticsCategoryHealthRow = components["schemas"]["AnalyticsCategoryHealthRow"];
export type AnalyticsWorkspaceHealth = components["schemas"]["AnalyticsWorkspaceHealth"];
export type AnalyticsWorkspaceHealthRow = components["schemas"]["AnalyticsWorkspaceHealthRow"];
export type AnalyticsBestTime = components["schemas"]["AnalyticsBestTime"];
export type AnalyticsBestTimeCell = components["schemas"]["AnalyticsBestTimeCell"];
export type AnalyticsAttention = components["schemas"]["AnalyticsAttention"];
export type AnalyticsAttentionTask = components["schemas"]["AnalyticsAttentionTask"];
export type AnalyticsKudosEffect = components["schemas"]["AnalyticsKudosEffect"];
export type AnalyticsSupportCoverage = components["schemas"]["AnalyticsSupportCoverage"];
export type AnalyticsSupporter = components["schemas"]["AnalyticsSupporter"];
export type AnalyticsLayout = components["schemas"]["AnalyticsLayout"];

export type AnalyticsRange = "week" | "month" | "sixmonth";

export interface AnalyticsFilters {
    range: AnalyticsRange;
    workspace?: string;
    category?: string;
}

/**
 * Fetch the analytics dashboard payload.
 * API: GET /v1/user/analytics?range=&workspace=&category=
 */
export const getAnalytics = async (filters: AnalyticsFilters): Promise<AnalyticsResponse> => {
    const query: Record<string, any> = { range: filters.range };
    if (filters.workspace) query.workspace = filters.workspace;
    if (filters.category) query.category = filters.category;

    try {
        const { data, error } = await client.GET("/v1/user/analytics" as any, {
            params: withAuthHeaders({ query }),
        });

        if (error) {
            throw new Error(`Failed to fetch analytics: ${JSON.stringify(error)}`);
        }

        return data as AnalyticsResponse;
    } catch (error) {
        logger.error("Error fetching analytics", error);
        throw error;
    }
};

/** Fetch the user's saved dashboard layout (empty order = use client default). */
export const getAnalyticsLayout = async (): Promise<AnalyticsLayout> => {
    try {
        const { data, error } = await client.GET("/v1/user/analytics/layout" as any, {
            params: withAuthHeaders(),
        });
        if (error) {
            throw new Error(`Failed to fetch layout: ${JSON.stringify(error)}`);
        }
        return data as AnalyticsLayout;
    } catch (error) {
        logger.error("Error fetching analytics layout", error);
        throw error;
    }
};

/** Persist the user's dashboard layout (order + hidden). */
export const saveAnalyticsLayout = async (layout: AnalyticsLayout): Promise<AnalyticsLayout> => {
    const { data, error } = await client.PUT("/v1/user/analytics/layout" as any, {
        params: withAuthHeaders(),
        body: layout,
    });
    if (error) {
        throw new Error(`Failed to save layout: ${JSON.stringify(error)}`);
    }
    return data as AnalyticsLayout;
};
