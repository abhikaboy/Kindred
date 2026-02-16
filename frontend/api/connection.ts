import { client } from "@/hooks/useTypedAPI";

// Helper to inject auth headers
const withAuthHeaders = (params: any = {}) => ({
    ...params,
    header: { Authorization: "", ...(params.header || {}) },
});

export interface BlockedUser {
    _id: string;
    name: string;
    handle: string;
    picture?: string;
}

/**
 * Block a user
 * @param userId - ID of the user to block
 */
export const blockUser = async (userId: string): Promise<{ message: string }> => {
    const { data, error } = await client.POST("/v1/user/connections/block/{userId}", {
        params: withAuthHeaders({ path: { userId } }),
    });

    if (error) {
        throw new Error(`Failed to block user: ${JSON.stringify(error)}`);
    }

    return data as any;
};

/**
 * Unblock a user
 * @param userId - ID of the user to unblock
 */
export const unblockUser = async (userId: string): Promise<{ message: string }> => {
    const { data, error } = await client.DELETE("/v1/user/connections/block/{userId}", {
        params: withAuthHeaders({ path: { userId } }),
    });

    if (error) {
        throw new Error(`Failed to unblock user: ${JSON.stringify(error)}`);
    }

    return data as any;
};

/**
 * Get list of blocked users
 */
export const getBlockedUsers = async (): Promise<BlockedUser[]> => {
    const { data, error } = await client.GET("/v1/user/connections/blocked", {
        params: withAuthHeaders(),
    });

    if (error) {
        throw new Error(`Failed to get blocked users: ${JSON.stringify(error)}`);
    }

    return data as any;
};

/**
 * Get list of friends
 */
export const getFriendsAPI = async (): Promise<any[]> => {
    const { data, error } = await client.GET("/v1/user/connections/friends", {
        params: withAuthHeaders(),
    });

    if (error) {
        throw new Error(`Failed to get friends: ${JSON.stringify(error)}`);
    }

    return data as any;
};

/**
 * Create a connection request (follow a user)
 * @param connectionData - Connection data with receiver_id
 */
export const createConnectionAPI = async (connectionData: { receiver_id: string }): Promise<any> => {
    const { data, error } = await client.POST("/v1/user/connections", {
        params: withAuthHeaders(),
        body: connectionData,
    });

    if (error) {
        throw new Error(`Failed to create connection: ${JSON.stringify(error)}`);
    }

    return data as any;
};

/**
 * Delete a connection request (unfollow/cancel request)
 * @param connectionId - ID of the connection to delete
 */
export const deleteConnectionAPI = async (connectionId: string): Promise<any> => {
    const { data, error } = await client.DELETE("/v1/user/connections/{id}", {
        params: withAuthHeaders({ path: { id: connectionId } }),
    });

    if (error) {
        throw new Error(`Failed to delete connection: ${JSON.stringify(error)}`);
    }

    return data as any;
};

/**
 * Accept a connection request
 * @param connectionId - ID of the connection to accept
 */
export const acceptConnectionAPI = async (connectionId: string): Promise<any> => {
    const { data, error } = await client.POST("/v1/user/connections/{id}/accept", {
        params: withAuthHeaders({ path: { id: connectionId } }),
    });

    if (error) {
        throw new Error(`Failed to accept connection: ${JSON.stringify(error)}`);
    }

    return data as any;
};

/**
 * Get connections received by the current user (pending follow requests)
 */
export const getConnectionsByReceiverAPI = async (): Promise<any[]> => {
    const { data, error } = await client.GET("/v1/user/connections/received", {
        params: withAuthHeaders(),
    });

    if (error) {
        throw new Error(`Failed to get received connections: ${JSON.stringify(error)}`);
    }

    return data as any;
};
