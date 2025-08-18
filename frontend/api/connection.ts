import { client } from "@/hooks/useTypedAPI";
import type { paths, components } from "./generated/types";
import { withAuthHeaders } from "./utils";

// Extract the type definitions from the generated types
type ConnectionDocument = components["schemas"]["ConnectionDocument"];
type CreateConnectionParams = components["schemas"]["CreateConnectionParams"];
type ConnectionUser = components["schemas"]["ConnectionUser"];

/**
 * Create a new friend connection request
 * API: Makes POST request to create connection
 * Frontend: Creates a connection request that will be sent to the receiver
 * @param connectionData - The connection data including receiver and requester information
 */
export const createConnectionAPI = async (connectionData: CreateConnectionParams): Promise<ConnectionDocument> => {
    const { data, error } = await client.POST("/v1/user/connections", {
        params: withAuthHeaders(),
        body: connectionData,
    });

    if (error) {
        throw new Error(`Failed to create connection: ${JSON.stringify(error)}`);
    }

    return data;
};

/**
 * Get all connections for the authenticated user
 * API: Makes GET request to retrieve user's connections
 * Frontend: Used to display connections in profile or activity feed
 */
export const getConnectionsAPI = async (): Promise<ConnectionDocument[]> => {
    const { data, error } = await client.GET("/v1/user/connections", {
        params: withAuthHeaders(),
    });

    if (error) {
        throw new Error(`Failed to get connections: ${JSON.stringify(error)}`);
    }

    return data || [];
};

/**
 * Get connections where the authenticated user is the receiver
 * API: Makes GET request to retrieve received connection requests
 * Frontend: Used to display pending connection requests
 */
export const getConnectionsByReceiverAPI = async (): Promise<ConnectionDocument[]> => {
    const { data, error } = await client.GET("/v1/user/connections/received", {
        params: withAuthHeaders(),
    });

    if (error) {
        throw new Error(`Failed to get received connections: ${JSON.stringify(error)}`);
    }

    return data || [];
};

/**
 * Get connections where a specific user is the requester
 * API: Makes GET request to retrieve connections requested by a specific user
 * Frontend: Used to check if a specific user has requested a connection
 * @param userId - The ID of the user to check for requests
 */
export const getConnectionsByRequesterAPI = async (userId: string): Promise<ConnectionDocument[]> => {
    const { data, error } = await client.GET("/v1/user/connections/requested/{id}", {
        params: withAuthHeaders({ path: { id: userId } }),
    });

    if (error) {
        throw new Error(`Failed to get connections by requester: ${JSON.stringify(error)}`);
    }

    return data || [];
};

/**
 * Get a specific connection by ID
 * API: Makes GET request to retrieve a specific connection
 * Frontend: Used to display individual connection details
 * @param connectionId - The ID of the connection to retrieve
 */
export const getConnectionByIdAPI = async (connectionId: string): Promise<ConnectionDocument> => {
    const { data, error } = await client.GET("/v1/user/connections/{id}", {
        params: withAuthHeaders({ path: { id: connectionId } }),
    });

    if (error) {
        throw new Error(`Failed to get connection: ${JSON.stringify(error)}`);
    }

    return data;
};

/**
 * Delete/deny a connection request
 * API: Makes DELETE request to remove the connection
 * Frontend: Used to deny connection requests or cancel sent requests
 * @param connectionId - The ID of the connection to delete
 */
export const deleteConnectionAPI = async (connectionId: string): Promise<{ message: string }> => {
    const { data, error } = await client.DELETE("/v1/user/connections/{id}", {
        params: withAuthHeaders({ path: { id: connectionId } }),
    });

    if (error) {
        throw new Error(`Failed to delete connection: ${JSON.stringify(error)}`);
    }

    return data;
};

/**
 * Update a connection request (accept/deny)
 * API: Makes PATCH request to update the connection status
 * Frontend: Used to accept or deny connection requests
 * @param connectionId - The ID of the connection to update
 * @param updateData - The update data for the connection
 */
export const updateConnectionAPI = async (
    connectionId: string,
    updateData: components["schemas"]["UpdateConnectionDocument"]
): Promise<{ message: string }> => {
    const { data, error } = await client.PATCH("/v1/user/connections/{id}", {
        params: withAuthHeaders({ path: { id: connectionId } }),
        body: updateData,
    });

    if (error) {
        throw new Error(`Failed to update connection: ${JSON.stringify(error)}`);
    }

    return data;
};

/**
 * Accept a connection request
 * API: Makes POST request to accept a connection request
 * Frontend: Used to accept friend connection requests
 * @param connectionId - The ID of the connection request to accept
 */
export const acceptConnectionAPI = async (connectionId: string): Promise<components["schemas"]["AcceptConnectionOutputBody"]> => {
    const { data, error } = await client.POST("/v1/user/connections/{id}/accept", {
        params: withAuthHeaders({ path: { id: connectionId } }),
    });

    if (error) {
        throw new Error(`Failed to accept connection: ${JSON.stringify(error)}`);
    }

    return data;
};
