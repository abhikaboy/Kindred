import { client } from "@/hooks/useTypedAPI";
import type { paths, components } from "./generated/types";
import { withAuthHeaders } from "./utils";

// Extract the type definitions from the generated types
type CongratulationDocument = components["schemas"]["CongratulationDocument"];
type CreateCongratulationParams = components["schemas"]["CreateCongratulationParams"];

/**
 * Create a new congratulation message for another user
 * API: Makes POST request to create congratulation
 * Frontend: Creates a congratulation that will be sent to the receiver
 * @param congratulationData - The congratulation data including receiver, message, categoryName, and taskName
 */
export const createCongratulationAPI = async (
    congratulationData: CreateCongratulationParams
): Promise<CongratulationDocument> => {
    const { data, error } = await client.POST("/v1/user/congratulations", {
        params: withAuthHeaders(),
        body: congratulationData,
    });

    if (error) {
        throw new Error(`Failed to create congratulation: ${JSON.stringify(error)}`);
    }

    return data;
};

/**
 * Get all congratulations received by the authenticated user
 * API: Makes GET request to retrieve user's congratulations
 * Frontend: Used to display congratulations in notifications or activity feed
 */
export const getCongratulationsAPI = async (): Promise<CongratulationDocument[]> => {
    const { data, error } = await client.GET("/v1/user/congratulations", {
        params: withAuthHeaders(),
    });

    if (error) {
        throw new Error(`Failed to get congratulations: ${JSON.stringify(error)}`);
    }

    return data || [];
};

/**
 * Mark multiple congratulations as read
 * API: Makes PATCH request to mark congratulations as read
 * Frontend: Used when user views their congratulations
 * @param ids - Array of congratulation IDs to mark as read
 */
export const markCongratulationsReadAPI = async (ids: string[]): Promise<{ count: number; message: string }> => {
    const { data, error } = await client.PATCH("/v1/user/congratulations/mark-read", {
        params: withAuthHeaders(),
        body: {
            id: ids
        },
    });

    if (error) {
        throw new Error(`Failed to mark congratulations as read: ${JSON.stringify(error)}`);
    }

    return data;
};

/**
 * Get a specific congratulation by ID
 * API: Makes GET request to retrieve a specific congratulation
 * Frontend: Used to display individual congratulation details
 * @param id - The ID of the congratulation to retrieve
 */
export const getCongratulationByIdAPI = async (id: string): Promise<CongratulationDocument> => {
    const { data, error } = await client.GET("/v1/user/congratulations/{id}", {
        params: withAuthHeaders({ path: { id } }),
    });

    if (error) {
        throw new Error(`Failed to get congratulation: ${JSON.stringify(error)}`);
    }

    return data;
};

/**
 * Update a congratulation message
 * API: Makes PATCH request to update the congratulation
 * Frontend: Used to edit congratulation messages
 * @param id - The ID of the congratulation to update
 * @param message - The new message content
 */
export const updateCongratulationAPI = async (id: string, message: string): Promise<{ message: string }> => {
    const { data, error } = await client.PATCH("/v1/user/congratulations/{id}", {
        params: withAuthHeaders({ path: { id } }),
        body: { message },
    });

    if (error) {
        throw new Error(`Failed to update congratulation: ${JSON.stringify(error)}`);
    }

    return data;
};

/**
 * Delete a congratulation message
 * API: Makes DELETE request to remove the congratulation
 * Frontend: Used to delete congratulation messages
 * @param id - The ID of the congratulation to delete
 */
export const deleteCongratulationAPI = async (id: string): Promise<{ message: string }> => {
    const { data, error } = await client.DELETE("/v1/user/congratulations/{id}", {
        params: withAuthHeaders({ path: { id } }),
    });

    if (error) {
        throw new Error(`Failed to delete congratulation: ${JSON.stringify(error)}`);
    }

    return data;
};