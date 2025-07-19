import {client } from "@/hooks/useTypedAPI"; 
import type { paths, components} from "./generated/types";

// Helper to inject auth headers that will be overridden by middleware
const withAuthHeaders = (params: any = {}) => ({
    ...params,
    header: { Authorization: "", ...(params.header || {}) },
});

type BlueprintDocument = components["schemas"]["BlueprintDocument"];
type CreateBlueprintParams = components["schemas"]["CreateBlueprintParams"];
type UpdateBlueprintDocument = components["schemas"]["UpdateBlueprintDocument"];
type UpdateBlueprintOutputBody = components["schemas"]["UpdateBlueprintOutputBody"];
type DeleteBlueprintOutputBody = components["schemas"]["DeleteBlueprintOutputBody"];
type SubscribeToBlueprintOutputBody = components["schemas"]["SubscribeToBlueprintOutputBody"];
type UnsubscribeFromBlueprintOutputBody = components["schemas"]["UnsubscribeFromBlueprintOutputBody"];


/**
 * Create blueprints from backend 
 * @param banner 
 * @param name 
 * @param tags 
 * @param description 
 * @param duration 
 * @returns 
 */
export async function createBlueprintToBackend(
    banner: string,
    name: string,
    tags: string[],
    description: string,
    duration: string
) {
    try {
        const result = await createBlueprint(banner, name, tags, description, duration);
        console.log("Blueprint created successfully:", result);
        return result;
    } catch (error) {
        console.error("Failed to create blueprint:", error);
        throw error;
    }
}

/**
 * Update blueprints from backend
 * @param blueprintId 
 * @param updateData 
 * @returns 
 */
export async function updateBlueprintToBackend(
    blueprintId: string, 
    updateData: UpdateBlueprintDocument
) {
    try {
        const result = await updateBlueprint(blueprintId, updateData);
        console.log("Blueprint updated successfully:", result);
        return result;
    } catch (error) {
        console.error("Failed to update blueprint:", error);
        throw error;
    }
}

/**
 * Delete blueprint to backend
 * @param blueprintId 
 * @returns 
 */
export async function deleteBlueprintToBackend(
    blueprintId: string, 
) {
    try {
        const result = await deleteBlueprint(blueprintId);
        console.log("Blueprint deleted successfully:", result);
        return result;
    } catch (error) {
        console.error("Failed to delete blueprint:", error);
        throw error;
    }
}

/**
 * Get blueprint by id to backend
 * @param blueprintId 
 * @returns 
 */
export async function getBlueprintByIdToBackend(
    blueprintId: string, 
) {
    try {
        const result = await getBlueprintById(blueprintId);
        console.log("Blueprint got successfully:", result);
        return result;
    } catch (error) {
        console.error("Failed to get blueprint:", error);
        throw error;
    }
}

/**
 * get blueprints to backend
 * @returns 
 */
export async function getBlueprintsToBackend(
) {
    try {
        const result = await getAllBlueprints();
        console.log("Blueprints got successfully:", result);
        return result;
    } catch (error) {
        console.error("Failed to get blueprints:", error);
        throw error;
    }
}

/**
 * subscribe to blueprint to backend
 * @param blueprintId 
 * @returns 
 */
export async function subscribeToBlueprintToBackend(
    blueprintId: string, 
) {
    try {
        const result = await subscribeToBlueprint(blueprintId);
        console.log("Blueprint subscribed to successfully:", result);
        return result;
    } catch (error) {
        console.error("Failed to subscribe to blueprint:", error);
        throw error;
    }
}

/**
 * un subscribe to blueprint to backend
 * @param blueprintId 
 * @returns 
 */
export async function unsubscribeToBlueprintToBackend(
    blueprintId: string, 
) {
    try {
        const result = await unSubscribeToBlueprint(blueprintId);
        console.log("Blueprint unsubscribed to successfully:", result);
        return result;
    } catch (error) {
        console.error("Failed to unsubscribe to blueprint:", error);
        throw error;
    }
}

/**
 * Search blueprints from backend
 * @param query 
 * @returns 
 */
export async function searchBlueprintsFromBackend(query: string) {
    try {
        const results = await searchBlueprints(query);
        console.log("Search results:", results);
        return results;
    } catch (error) {
        console.error("Failed to search blueprints:", error);
        throw error;
    }
}


/**
 * Creates a new blueprint 
 * @param banner 
 * @param name 
 * @param tags 
 * @param description 
 * @param duration 
 * @returns 
 */
export const createBlueprint = async (
    banner: string,
    name: string,
    tags: string[],
    description: string,
    duration: string
): Promise<BlueprintDocument> => {
    const { data, error } = await client.POST("/v1/user/blueprints", {
        params: withAuthHeaders({}),
        body: { banner, name, tags, description, duration },
    });

    if (error) {
        throw new Error(`Failed to create blueprint: ${JSON.stringify(error)}`);
    }

    return data;
};


/**
 * Update Blueprint
 * @param blueprintId 
 * @param updateData 
 */
export const updateBlueprint = async (
    blueprintId: string,
    updateData: UpdateBlueprintDocument
): Promise<void> => {
    const { error } = await client.PATCH("/v1/user/blueprints/{id}", {
        params: withAuthHeaders({ path: {id: blueprintId}}),
        body: updateData,
    }) 

    if (error) {
        throw new Error(`Failed to update blueprint: ${JSON.stringify(error)}`);
    }
}


/**
 * Delete Blueprint 
 * @param blueprintId 
 */
export const deleteBlueprint = async (blueprintId: string): Promise<void> => {
    const { error } = await client.DELETE("/v1/user/blueprints/{id}", {
        params: withAuthHeaders({path: {id: blueprintId}}),
    });
    if (error) {
        throw new Error(`Failed to delete blueprint: ${JSON.stringify(error)}`);
    }
}

/**
 * Get blueprint by ID 
 * @param blueprintId 
 * @returns 
 */
export const getBlueprintById = async (blueprintId: string): Promise<BlueprintDocument> => {
    const {data, error} = await client.GET("/v1/blueprints/{id}", {
        params: withAuthHeaders({path: {id: blueprintId}}), 
    }); 
    if (error) {
        throw new Error(`Failed to get blueprint: ${JSON.stringify(error)}`);
    }

    return data; 
}

/**
 * Get all blueprint 
 * @param blueprintId 
 * @returns 
 */
export const getAllBlueprints = async (): Promise<BlueprintDocument[]> => {
    const {data, error} = await client.GET("/v1/blueprints", {
        params: withAuthHeaders({}), 
    }); 
    if (error) {
        throw new Error(`Failed to get all blueprints: ${JSON.stringify(error)}`);
    }

    return data || []; 
}


/**
 * Subscribe to blueprint
 * @param blueprintId 
 * @returns 
 */
export const subscribeToBlueprint = async (blueprintId: string): Promise<SubscribeToBlueprintOutputBody> => {
    const { data, error } = await client.PATCH("/v1/user/blueprints/{id}/subscribe", {
        params: withAuthHeaders({ path: { id: blueprintId } }), 
    }); 
    if (error) {
        throw new Error(`Failed to subscribe to blueprint: ${JSON.stringify(error)}`);
    }
    return data; 
}

/**
 * Un Subscribe to blueprint
 * @param blueprintId 
 * @returns 
 */
export const unSubscribeToBlueprint = async (blueprintId: string): Promise<UnsubscribeFromBlueprintOutputBody> => {
    const { data, error } = await client.PATCH("/v1/user/blueprints/{id}/unsubscribe", {
        params: withAuthHeaders({ path: { id: blueprintId } }), 
    }); 
    if (error) {
        throw new Error(`Failed to unsubscribe to blueprint: ${JSON.stringify(error)}`);
    }
    return data; 
}
/**
 * search blueprints
 * @param query 
 * @returns 
 */
export const searchBlueprints = async (query: string): Promise<BlueprintDocument[]> => {
    const { data, error } = await client.GET("/v1/blueprints/search/", {
        params: withAuthHeaders({ 
            query: { query : query },
        }),
    });

    if (error) {
        throw new Error(`Failed to search blueprints: ${JSON.stringify(error)}`);
    }

    return data || [];
};