import { Categories } from "./types";
import { useRequest } from "@/hooks/useRequest";

/**
 * Creates a new category in a workspace
 * API: Makes POST request to create a new category
 * Frontend: The response is used to update the categories state in TaskContext
 * @param name - The name of the category to create
 * @param workspaceName - The name of the workspace to add the category to
 */
export const createCategory = async (name: string, workspaceName: string): Promise<Categories> => {
    const { request } = useRequest();
    return await request("POST", `/user/categories`, {
        name: name,
        workspaceName: workspaceName,
    });
};

/**
 * Deletes a category
 * API: Makes DELETE request to remove the category
 * Frontend: The category is removed from the categories state in TaskContext
 * @param categoryId - The ID of the category to delete
 */
export const deleteCategory = async (categoryId: string): Promise<void> => {
    const { request } = useRequest();
    await request("DELETE", `/user/categories/${categoryId}`);
};
