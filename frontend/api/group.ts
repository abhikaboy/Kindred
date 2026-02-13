import client from "./client";
import { withAuthHeaders } from "./utils";
import { components } from "./generated/types";
import { createLogger } from "@/utils/logger";

const logger = createLogger('GroupAPI');

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

    // Response structure: { groups: [...] }
    return (data as any)?.groups || [];
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

    // Response is the group document directly
    return data as unknown as GroupDocument;
};

/**
 * Create a new group
 */
export const createGroup = async (params: CreateGroupParams): Promise<GroupDocument> => {
    logger.debug('createGroup called', params);

    const { data, error } = await client.POST("/v1/user/groups", {
        params: withAuthHeaders({}),
        body: params,
    });

    logger.debug('createGroup response received', { hasData: !!data, hasError: !!error });

    if (error) {
        logger.error('createGroup error', error);
        throw new Error(`Failed to create group: ${JSON.stringify(error)}`);
    }

    // The response data IS the group document (not nested under body)
    const result = data as unknown as GroupDocument;
    logger.debug('createGroup returning', { groupId: result?.id });
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
