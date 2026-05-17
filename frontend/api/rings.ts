import client from "./client";
import { withAuthHeaders } from "./utils";
import { createLogger } from "@/utils/logger";
import { RingTodayResponse, RingHistoryResponse, RingRewardResponse } from "./types";

const logger = createLogger('RingsAPI');

/**
 * Get today's ring state and productivity score
 * API: GET /v1/user/rings/today
 */
export const getRingsToday = async (): Promise<RingTodayResponse> => {
    try {
        const { data, error } = await client.GET("/v1/user/rings/today" as any, {
            params: withAuthHeaders(),
        });

        if (error) {
            throw new Error(`Failed to fetch rings today: ${JSON.stringify(error)}`);
        }

        return data as RingTodayResponse;
    } catch (error) {
        logger.error("Error fetching rings today", error);
        throw error;
    }
};

/**
 * Get ring history for the last N days
 * API: GET /v1/user/rings/history?days=N
 * @param days - Number of days of history to fetch (default: server decides)
 */
export const getRingsHistory = async (days?: number): Promise<RingHistoryResponse> => {
    try {
        const query: Record<string, any> = {};
        if (days !== undefined) {
            query.days = days;
        }

        const { data, error } = await client.GET("/v1/user/rings/history" as any, {
            params: withAuthHeaders({ query }),
        });

        if (error) {
            throw new Error(`Failed to fetch rings history: ${JSON.stringify(error)}`);
        }

        return data as RingHistoryResponse;
    } catch (error) {
        logger.error("Error fetching rings history", error);
        throw error;
    }
};

/**
 * Claim the daily ring completion reward
 * API: POST /v1/user/rings/reward
 */
export const claimRingReward = async (): Promise<RingRewardResponse> => {
    try {
        const { data, error } = await client.POST("/v1/user/rings/reward" as any, {
            params: withAuthHeaders(),
        });

        if (error) {
            throw new Error(`Failed to claim ring reward: ${JSON.stringify(error)}`);
        }

        return data as RingRewardResponse;
    } catch (error) {
        logger.error("Error claiming ring reward", error);
        throw error;
    }
};
