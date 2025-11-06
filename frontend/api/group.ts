import client from "./client";
import { withAuthHeaders } from "./utils";
import { components } from "./generated/types";

// Types
export type GroupDocument = components["schemas"]["GroupDocumentAPI"];

export interface CreateGroupParams {
    name: string;
    members?: string[];
}

/**
 * Get all groups where user is creator or member
 */
export const getUserGroups = async (): Promise<GroupDocument[]> => {
    const { data, error } = await client.GET("/v1/user/groups", {
        params: withAuthHeaders({}),
    });

    if (error) {
        throw new Error(`Failed to fetch groups: ${JSON.stringify(error)}`);
    }

    return (data?.body as any)?.groups || [];
};

/**
 * Get a specific group by ID
 */
export const getGroupById = async (groupId: string): Promise<GroupDocument> => {
    const { data, error } = await client.GET("/v1/user/groups/{id}", {
        params: {
            ...withAuthHeaders({}),
            path: { id: groupId },
        },
    });

    if (error) {
        throw new Error(`Failed to fetch group: ${JSON.stringify(error)}`);
    }

    return data?.body as GroupDocument;
};

/**
 * Create a new group
 */
export const createGroup = async (params: CreateGroupParams): Promise<GroupDocument> => {
    console.log('🔵 createGroup called with params:', params);
    
    const { data, error } = await client.POST("/v1/user/groups", {
        params: withAuthHeaders({}),
        body: params,
    });

    console.log('🔵 createGroup response - data:', data);
    console.log('🔵 createGroup response - error:', error);

    if (error) {
        console.error('🔴 createGroup error:', JSON.stringify(error, null, 2));
        throw new Error(`Failed to create group: ${JSON.stringify(error)}`);
    }

    const result = data?.body as GroupDocument;
    console.log('🔵 createGroup returning:', result);
    return result;
};

/**
 * Update a group (creator only)
 */
export const updateGroup = async (groupId: string, name: string): Promise<void> => {
    const { error } = await client.PATCH("/v1/user/groups/{id}", {
        params: {
            ...withAuthHeaders({}),
            path: { id: groupId },
        },
        body: { name },
    });

    if (error) {
        throw new Error(`Failed to update group: ${JSON.stringify(error)}`);
    }
};

/**
 * Delete a group (creator only)
 */
export const deleteGroup = async (groupId: string): Promise<void> => {
    const { error } = await client.DELETE("/v1/user/groups/{id}", {
        params: {
            ...withAuthHeaders({}),
            path: { id: groupId },
        },
    });

    if (error) {
        throw new Error(`Failed to delete group: ${JSON.stringify(error)}`);
    }
};

