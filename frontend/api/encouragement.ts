import client from "@/api/client";
import type { paths, components } from "./generated/types";
import { withAuthHeaders } from "./utils";
import type { RingDelta } from "./types";
import * as SecureStore from "expo-secure-store";
import axios from "axios";
import { createLogger } from "@/utils/logger";

const logger = createLogger('EncouragementAPI');

// Extract the type definitions from the generated types
type EncouragementDocument = components["schemas"]["EncouragementDocument"];
type CreateEncouragementParams = components["schemas"]["CreateEncouragementParams"];

/**
 * Create a new encouragement message for another user
 * API: Makes POST request to create encouragement
 * Frontend: Creates an encouragement that will be sent to the receiver
 * @param encouragementData - The encouragement data including receiver, message, categoryName, and taskName
 */
export const createEncouragementAPI = async (
    encouragementData: CreateEncouragementParams
): Promise<EncouragementDocument & { ringDelta?: RingDelta }> => {
    const { data, error } = await client.POST("/v1/user/encouragements", {
        params: withAuthHeaders(),
        body: encouragementData,
    });

    if (error) {
        throw new Error(`Failed to create encouragement: ${JSON.stringify(error)}`);
    }

    return data as unknown as EncouragementDocument & { ringDelta?: RingDelta };
};

/**
 * Get all encouragements received by the authenticated user
 * API: Makes GET request to retrieve user's encouragements
 * Frontend: Used to display encouragements in notifications or activity feed
 */
export const getEncouragementsAPI = async (): Promise<EncouragementDocument[]> => {
    const { data, error } = await client.GET("/v1/user/encouragements", {
        params: withAuthHeaders(),
    });

    if (error) {
        throw new Error(`Failed to get encouragements: ${JSON.stringify(error)}`);
    }

    return data || [];
};

/**
 * Mark multiple encouragements as read
 * API: Makes PATCH request to mark encouragements as read
 * Frontend: Used when user views their encouragements
 * @param ids - Array of encouragement IDs to mark as read
 */
export const markEncouragementsReadAPI = async (ids: string[]): Promise<{ count: number; message: string }> => {
    logger.debug("markEncouragementsReadAPI called", { ids });

    // Get auth data from SecureStore
    let headers: any = {
        "Content-Type": "application/json",
    };

    try {
        const authData = await SecureStore.getItemAsync("auth_data");
        if (authData) {
            const parsed = JSON.parse(authData);
            if (parsed.access_token) {
                headers["Authorization"] = `Bearer ${parsed.access_token}`;
            }
            if (parsed.refresh_token) {
                headers["refresh_token"] = parsed.refresh_token;
            }
        }
    } catch (error) {
        logger.error("Error getting auth data for request", error);
    }

    // ✅ CORRECT: Send { id: [...] } directly, not { body: { id: [...] } }
    const requestBody = { id: ids };
    logger.debug("Request body being sent", requestBody);

    try {
        // ✅ Use axios directly instead of useRequest() hook
        const response = await axios({
            url: process.env.EXPO_PUBLIC_URL + "/api/v1/user/encouragements/mark-read",
            method: "PATCH",
            headers: headers,
            data: requestBody,
        });

        logger.info("Mark as read successful");
        return response.data;
    } catch (error: any) {
        logger.error("Mark as read failed", error.response?.data || error.message);
        throw new Error(`Failed to mark encouragements as read: ${JSON.stringify(error.response?.data || error.message)}`);
    }
};

/**
 * Get a specific encouragement by ID
 * API: Makes GET request to retrieve a specific encouragement
 * Frontend: Used to display individual encouragement details
 * @param id - The ID of the encouragement to retrieve
 */
export const getEncouragementByIdAPI = async (id: string): Promise<EncouragementDocument> => {
    const { data, error } = await client.GET("/v1/user/encouragements/{id}", {
        params: withAuthHeaders({ path: { id } }),
    });

    if (error) {
        throw new Error(`Failed to get encouragement: ${JSON.stringify(error)}`);
    }

    return data;
};

/**
 * Update an encouragement message
 * API: Makes PATCH request to update the encouragement
 * Frontend: Used to edit encouragement messages
 * @param id - The ID of the encouragement to update
 * @param message - The new message content
 */
export const updateEncouragementAPI = async (id: string, message: string): Promise<{ message: string }> => {
    const { data, error } = await client.PATCH("/v1/user/encouragements/{id}", {
        params: withAuthHeaders({ path: { id } }),
        body: { message },
    });

    if (error) {
        throw new Error(`Failed to update encouragement: ${JSON.stringify(error)}`);
    }

    return data;
};

/**
 * Get encouragements received by the current user that are scoped to a specific task.
 * Filters the full encouragements list client-side since the backend endpoint doesn't
 * support task-scoped queries from the frontend.
 * @param taskId - The task ID to filter by
 */
export const getEncouragementsByTask = async (taskId: string): Promise<EncouragementDocument[]> => {
    const all = await getEncouragementsAPI();
    return all.filter((e) => e.taskId === taskId);
};

/**
 * Get all encouragements sent by the authenticated user (with receiver info + reaction state)
 * API: Makes GET request to retrieve sent encouragements
 * Frontend: Used by the Sent view on the Kudos screen
 */
export const getSentEncouragementsAPI = async (): Promise<EncouragementDocument[]> => {
    const { data, error } = await client.GET("/v1/user/encouragements/sent", {
        params: withAuthHeaders(),
    });

    if (error) {
        throw new Error(`Failed to get sent encouragements: ${JSON.stringify(error)}`);
    }

    return data || [];
};

/**
 * Toggle the receiver's emoji reaction on an encouragement
 * API: Makes POST request to toggle the reaction
 * Frontend: Used by the reaction bar on received kudos cards
 * @param id - The encouragement ID
 * @param emoji - One of KUDOS_REACTION_EMOJIS
 */
export const reactToEncouragementAPI = async (
    id: string,
    emoji: string
): Promise<{ reaction: string | null; message: string }> => {
    const { data, error } = await client.POST("/v1/user/encouragements/{id}/reaction", {
        params: withAuthHeaders({ path: { id } }),
        body: { emoji },
    });

    if (error) {
        throw new Error(`Failed to react to encouragement: ${JSON.stringify(error)}`);
    }

    return data as { reaction: string | null; message: string };
};

/**
 * Delete an encouragement message
 * API: Makes DELETE request to remove the encouragement
 * Frontend: Used to delete encouragement messages
 * @param id - The ID of the encouragement to delete
 */
export const deleteEncouragementAPI = async (id: string): Promise<{ message: string }> => {
    const { data, error } = await client.DELETE("/v1/user/encouragements/{id}", {
        params: withAuthHeaders({ path: { id } }),
    });

    if (error) {
        throw new Error(`Failed to delete encouragement: ${JSON.stringify(error)}`);
    }

    return data;
};
