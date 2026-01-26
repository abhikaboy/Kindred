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
