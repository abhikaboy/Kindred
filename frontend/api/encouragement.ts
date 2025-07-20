import { client } from "@/hooks/useTypedAPI";
import type { paths, components } from "./generated/types";
import { withAuthHeaders } from "./utils";
import * as SecureStore from "expo-secure-store";
import { useRequest } from "@/hooks/useRequest";

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
): Promise<EncouragementDocument> => {
    const { data, error } = await client.POST("/v1/user/encouragements", {
        params: withAuthHeaders(),
        body: encouragementData,
    });

    if (error) {
        throw new Error(`Failed to create encouragement: ${JSON.stringify(error)}`);
    }

    return data;
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
    const { request } = useRequest();

    // Use direct request since OpenAPI spec is missing request body definition
    const response = await request("PATCH", "/user/encouragements/mark-read", {
        body: { id: ids },
    });

    return response;
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
