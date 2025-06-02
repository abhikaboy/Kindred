import { Task, Categories, Workspace, CompleteTaskBody } from "./types";
import { useRequest } from "@/hooks/useRequest";

// Backend CreateTaskParams equivalent
export type CreateTaskParams = {
    priority: number; // 1-3
    content: string;
    value: number; // 0-10
    recurring: boolean;
    recurFrequency?: string;
    recurDetails?: RecurDetails;
    public: boolean;
    active: boolean;
    deadline?: string;
    startTime?: string;
    startDate?: string;
    notes?: string;
    checklist?: ChecklistItem[];
    reminders?: Reminder[];
};

/**
 * Adds a task to a specific category
 * API: Makes POST request to add a task to a category
 * Frontend: Updates categories state in TaskContext by adding the task to the specified category
 * @param categoryId - The ID of the category to add the task to
 * @param task - The task to add
 */
export const addToCategory = async (categoryId: string, task: CreateTaskParams): Promise<void> => {
    const { request } = useRequest();
    return await request("POST", `/user/categories/${categoryId}/tasks`, task);
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
    return await request("DELETE", `/user/tasks/${categoryId}/${taskId}`);
};

/**
 * Marks a task as completed
 * API: Makes PUT request to mark a task as completed
 * Frontend: Updates task state in TaskContext by marking the task as completed
 * @param categoryId - The ID of the category to mark the task in
 * @param taskId - The ID of the task to mark as completed
 */
export const markAsCompletedAPI = async (categoryId: string, taskId: string, body: CompleteTaskBody): Promise<void> => {
    const { request } = useRequest();
    return request("POST", `/user/tasks/complete/${categoryId}/${taskId}`, body);
};

/**
 * Activates a task
 * API: Makes PUT request to activate a task
 * Frontend: Updates task state in TaskContext by activating the task
 * @param taskId - The ID of the task to activate
 * @param categoryId - The ID of the category to activate the task in
 */
export const activateTaskAPI = async (categoryId: string, taskId: string): Promise<void> => {
    const { request } = useRequest();
    return request("POST", `/user/tasks/active/${categoryId}/${taskId}`);
};

/**
 * Updates the Notes for a task
 * API: Makes PUT request to update the notes for a task
 * Frontend: Updates task state in TaskContext by updating the notes for the task
 * @param categoryId - The ID of the category to update the notes for
 * @param taskId - The ID of the task to update the notes for
 * @param notes - The new notes for the task
 */
export const updateNotesAPI = async (categoryId: string, taskId: string, notes: string): Promise<void> => {
    const { request } = useRequest();
    return request("POST", `/user/tasks/${categoryId}/${taskId}/notes`, { notes: notes });
};
