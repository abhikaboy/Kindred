import { Task, Categories, Workspace } from "./types";
import { useRequest } from "@/hooks/useRequest";

/**
 * Adds a task to a specific category
 * API: Makes POST request to add a task to a category
 * Frontend: Updates categories state in TaskContext by adding the task to the specified category
 * @param categoryId - The ID of the category to add the task to
 * @param task - The task to add
 */
export const addToCategory = async (categoryId: string, task: Task): Promise<void> => {
    const { request } = useRequest();
    await request("POST", `/user/categories/${categoryId}/tasks`, task);
};

/**
 * Removes a task from a category
 * API: Makes DELETE request to remove a task from a category
 * Frontend: Updates categories state in TaskContext by removing the task from the specified category
 * @param categoryId - The ID of the category to remove the task from
 * @param taskId - The ID of the task to remove
 */
export const removeFromCategoryAPI = async (categoryId: string, taskId: string): Promise<void> => {
    const { request } = useRequest();
    await request("DELETE", `/user/categories/${categoryId}/tasks/${taskId}`);
};
