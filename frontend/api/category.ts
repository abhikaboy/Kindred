import { client } from "@/hooks/useTypedAPI";
import type { paths, components } from "./generated/types";

// Helper to inject auth headers that will be overridden by middleware
const withAuthHeaders = (params: any = {}) => ({
    ...params,
    header: { Authorization: "", ...(params.header || {}) },
});

// Extract the type definitions from the generated types
type CategoryDocument = components["schemas"]["CategoryDocument"];
type CreateCategoryParams = components["schemas"]["CreateCategoryParams"];
type UpdateCategoryDocument = components["schemas"]["UpdateCategoryDocument"];
type WorkspaceResult = components["schemas"]["WorkspaceResult"];

/**
 * Creates a new category in a workspace
 * API: Makes POST request to create a new category
 * Frontend: The response is used to update the categories state in TaskContext
 * @param name - The name of the category to create
 * @param workspaceName - The name of the workspace to add the category to
 */
export const createCategory = async (name: string, workspaceName: string): Promise<CategoryDocument> => {
    const { data, error } = await client.POST("/v1/user/categories", {
        params: withAuthHeaders({}),
        body: { name, workspaceName },
    });

    if (error) {
        throw new Error(`Failed to create category: ${JSON.stringify(error)}`);
    }

    return data;
};

/**
 * Deletes a category
 * API: Makes DELETE request to remove the category
 * Frontend: The category is removed from the categories state in TaskContext
 * @param categoryId - The ID of the category to delete
 */
export const deleteCategory = async (categoryId: string): Promise<void> => {
    const { error } = await client.DELETE("/v1/user/categories/{id}", {
        params: withAuthHeaders({ path: { id: categoryId } }),
    });

    if (error) {
        throw new Error(`Failed to delete category: ${JSON.stringify(error)}`);
    }
};

/**
 * Update a category (type-safe)
 */
export const updateCategory = async (categoryId: string, updateData: UpdateCategoryDocument): Promise<void> => {
    const { error } = await client.PATCH("/v1/user/categories/{id}", {
        params: withAuthHeaders({ path: { id: categoryId } }),
        body: updateData,
    });

    if (error) {
        throw new Error(`Failed to update category: ${JSON.stringify(error)}`);
    }
};

/**
 * Get categories by user (type-safe)
 */
export const getCategoriesByUser = async (userId: string): Promise<WorkspaceResult[]> => {
    const { data, error } = await client.GET("/v1/user/categories/{id}", {
        params: withAuthHeaders({ path: { id: userId } }),
    });

    if (error) {
        throw new Error(`Failed to get categories: ${JSON.stringify(error)}`);
    }

    return data || [];
};

/**
 * Get all categories (type-safe)
 */
export const getAllCategories = async (): Promise<CategoryDocument[]> => {
    const { data, error } = await client.GET("/v1/categories", {
        params: withAuthHeaders({}),
    });

    if (error) {
        throw new Error(`Failed to get all categories: ${JSON.stringify(error)}`);
    }

    return data || [];
};

/**
 * Get category by ID (type-safe)
 */
export const getCategoryById = async (categoryId: string): Promise<CategoryDocument> => {
    const { data, error } = await client.GET("/v1/categories/{id}", {
        params: withAuthHeaders({ path: { id: categoryId } }),
    });

    if (error) {
        throw new Error(`Failed to get category: ${JSON.stringify(error)}`);
    }

    return data;
};

/**
 * Get user workspaces (type-safe)
 */
export const getUserWorkspaces = async (): Promise<WorkspaceResult[]> => {
    const { data, error } = await client.GET("/v1/user/workspaces", {
        params: withAuthHeaders({}),
    });

    if (error) {
        throw new Error(`Failed to get workspaces: ${JSON.stringify(error)}`);
    }

    return data || [];
};

/**
 * Delete workspace (type-safe)
 */
export const deleteWorkspace = async (workspaceName: string): Promise<void> => {
    const { error } = await client.DELETE("/v1/user/categories/workspace/{name}", {
        params: withAuthHeaders({ path: { name: workspaceName } }),
    });

    if (error) {
        throw new Error(`Failed to delete workspace: ${JSON.stringify(error)}`);
    }
};
