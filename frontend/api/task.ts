import { client } from "@/hooks/useTypedAPI";
import type { paths, components } from "./generated/types";
import { withAuthHeaders } from "./utils";

// Extract the type definitions from the generated types
type TaskDocument = components["schemas"]["TaskDocument"];
type UpdateTaskChecklistDocument = components["schemas"]["UpdateTaskChecklistDocument"];
type UpdateTaskNotesDocument = components["schemas"]["UpdateTaskNotesDocument"];
type CreateTaskParams = components["schemas"]["CreateTaskParams"];
type CompleteTaskDocument = components["schemas"]["CompleteTaskDocument"];
type TemplateTaskDocument = components["schemas"]["TemplateTaskDocument"];

/**
 * Create a new task in a specific category
 * API: Makes POST request to create task in the specified category
 * Frontend: Updates categories state in TaskContext by adding the task to the specified category
 * @param categoryId - The ID of the category to add the task to
 * @param task - The task data to create
 */
export const createTaskAPI = async (categoryId: string, task: CreateTaskParams): Promise<TaskDocument> => {
    const { data, error } = await client.POST("/v1/user/tasks/{category}", {
        params: withAuthHeaders({
            path: { category: categoryId },
        }),
        body: task,
    });

    if (error) {
        throw new Error(`Failed to create task: ${JSON.stringify(error)}`);
    }

    return data;
};

/**
 * Remove a task from a category
 * API: Makes DELETE request to remove the task
 * Frontend: The task is removed from the category in TaskContext
 * @param categoryId - The ID of the category the task belongs to
 * @param taskId - The ID of the task to delete
 */
export const removeFromCategoryAPI = async (categoryId: string, taskId: string): Promise<void> => {
    const { error } = await client.DELETE("/v1/user/tasks/{category}/{id}", {
        params: withAuthHeaders({ path: { category: categoryId, id: taskId } }),
    });

    if (error) {
        throw new Error(`Failed to delete task: ${JSON.stringify(error)}`);
    }
};

/**
 * Update task checklist
 * API: Makes POST request to update the checklist field
 * Frontend: The checklist is updated in the task in TaskContext
 * @param categoryId - The ID of the category the task belongs to
 * @param taskId - The ID of the task to update
 * @param checklist - The new checklist data
 */
export const updateChecklistAPI = async (
    categoryId: string,
    taskId: string,
    checklist: UpdateTaskChecklistDocument["checklist"]
): Promise<void> => {
    const { error } = await client.POST("/v1/user/tasks/{category}/{id}/checklist", {
        params: withAuthHeaders({ path: { category: categoryId, id: taskId } }),
        body: { checklist },
    });

    if (error) {
        throw new Error(`Failed to update checklist: ${JSON.stringify(error)}`);
    }
};

/**
 * Update task notes
 * API: Makes POST request to update the notes field
 * Frontend: The notes are updated in the task in TaskContext
 * @param categoryId - The ID of the category the task belongs to
 * @param taskId - The ID of the task to update
 * @param notes - The new notes content
 */
export const updateNotesAPI = async (categoryId: string, taskId: string, notes: string): Promise<void> => {
    const { error } = await client.POST("/v1/user/tasks/{category}/{id}/notes", {
        params: withAuthHeaders({ path: { category: categoryId, id: taskId } }),
        body: { notes },
    });

    if (error) {
        throw new Error(`Failed to update notes: ${JSON.stringify(error)}`);
    }
};

/**
 * Result from marking a task as completed
 */
export interface TaskCompletionResult {
    message: string;
    streakChanged: boolean;
    currentStreak: number;
    tasksComplete: number;
}

/**
 * Mark a task as completed
 * API: Makes POST request to complete the task
 * Frontend: The task is marked as completed in TaskContext
 * @param categoryId - The ID of the category the task belongs to
 * @param taskId - The ID of the task to complete
 * @param completeData - The completion data
 * @returns TaskCompletionResult containing streak information
 */
export const markAsCompletedAPI = async (
    categoryId: string,
    taskId: string,
    completeData: CompleteTaskDocument
): Promise<TaskCompletionResult> => {
    const { data, error } = await client.POST("/v1/user/tasks/complete/{category}/{id}", {
        params: withAuthHeaders({ path: { category: categoryId, id: taskId } }),
        body: completeData,
    });

    if (error) {
        throw new Error(`Failed to complete task: ${JSON.stringify(error)}`);
    }

    if (!data) {
        throw new Error("No response data from task completion");
    }

    // Cast to TaskCompletionResult since the API schema may not be regenerated yet
    return data as unknown as TaskCompletionResult;
};

/**
 * Activate/deactivate a task
 * API: Makes POST request to change task active status
 * Frontend: The task active status is updated in TaskContext
 * @param categoryId - The ID of the category the task belongs to
 * @param taskId - The ID of the task to activate/deactivate
 * @param active - Whether to activate (true) or deactivate (false) the task
 */
export const activateTaskAPI = async (categoryId: string, taskId: string, active: boolean = true): Promise<void> => {
    const { error } = await client.POST("/v1/user/tasks/active/{category}/{id}", {
        params: withAuthHeaders({
            path: { category: categoryId, id: taskId },
            query: { active: active.toString() },
        }),
    });

    if (error) {
        throw new Error(`Failed to activate task: ${JSON.stringify(error)}`);
    }
};

/**
 * Get tasks by user
 * API: Makes GET request to retrieve user's tasks
 * Frontend: Used to populate tasks in TaskContext
 * @param id - Optional user ID filter
 * @param sortBy - Optional sort field
 * @param sortDir - Optional sort direction
 */
export const getTasksByUserAPI = async (id?: string, sortBy?: string, sortDir?: string): Promise<TaskDocument[]> => {
    const { data, error } = await client.GET("/v1/user/tasks/", {
        params: withAuthHeaders({
            query: { id, sortBy, sortDir },
        }),
    });

    if (error) {
        throw new Error(`Failed to get tasks: ${JSON.stringify(error)}`);
    }

    return data || [];
};

/**
 * Get template by ID
 * API: Makes GET request to retrieve a template by its ID
 * Frontend: Used to populate the template in TaskContext
 * @param id - The ID of the template to retrieve
 */
export const getTemplateByIDAPI = async (id: string): Promise<TemplateTaskDocument> => {
    const { data, error } = await client.GET("/v1/user/tasks/template/{id}", {
        params: withAuthHeaders({ path: { id } }),
    });

    if (error) {
        throw new Error(`Failed to get template: ${JSON.stringify(error)}`);
    }

    return data;
};

/**
 * Update a task with full task data
 * API: Makes PATCH request to update the task
 * Frontend: The task is updated in TaskContext
 * @param categoryId - The ID of the category the task belongs to
 * @param taskId - The ID of the task to update
 * @param updateData - The task data to update
 */
export const updateTaskAPI = async (
    categoryId: string,
    taskId: string,
    updateData: components["schemas"]["UpdateTaskDocument"]
): Promise<void> => {
    const { error } = await client.PATCH("/v1/user/tasks/{category}/{id}", {
        params: withAuthHeaders({ path: { category: categoryId, id: taskId } }),
        body: updateData,
    });

    if (error) {
        throw new Error(`Failed to update task: ${JSON.stringify(error)}`);
    }
};

/**
 * Get completed tasks
 * API: Makes GET request to retrieve completed tasks
 * Frontend: Used to get statistics for TodayStats component
 */
export const getCompletedTasksAPI = async (): Promise<TaskDocument[]> => {
    const { data, error } = await client.GET("/v1/user/tasks/completed", {
        params: withAuthHeaders({}),
    });

    if (error) {
        throw new Error(`Failed to get completed tasks: ${JSON.stringify(error)}`);
    }

    return data || [];
};

/**
 * Get today's completed tasks count
 * Helper function to get the count of tasks completed today
 */
export const getTodayCompletedTasksCount = async (): Promise<number> => {
    try {
        const completedTasks = await getCompletedTasksAPI();
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        
        const todayCompletedTasks = completedTasks.filter(task => {
            if (task.timeCompleted) {
                const completedDate = new Date(task.timeCompleted);
                return completedDate >= todayStart;
            }
            return false;
        });
        
        return todayCompletedTasks.length;
    } catch (error) {
        console.error('Error getting today completed tasks count:', error);
        return 0;
    }
};

/**
 * Get total points from completed tasks
 * Helper function to calculate total points from completed tasks
 */
export const getTotalPointsFromCompletedTasks = async (): Promise<number> => {
    try {
        const completedTasks = await getCompletedTasksAPI();
        return completedTasks.reduce((total, task) => total + (task.value || 0), 0);
    } catch (error) {
        console.error('Error getting total points from completed tasks:', error);
        return 0;
    }
};

/**
 * Update task deadline using specialized endpoint
 * @param categoryId - The ID of the category the task belongs to
 * @param taskId - The ID of the task to update
 * @param deadline - The new deadline date (or null to remove)
 */
export const updateTaskDeadlineAPI = async (
    categoryId: string, 
    taskId: string, 
    deadline: Date | null
): Promise<void> => {
    const { error } = await client.PATCH("/v1/user/category/{category}/task/{id}/deadline", {
        params: withAuthHeaders({ 
            path: { category: categoryId, id: taskId } 
        }),
        body: { deadline: deadline?.toISOString() || null },
    });

    if (error) {
        throw new Error(`Failed to update task deadline: ${JSON.stringify(error)}`);
    }
};

/**
 * Update task start date/time using specialized endpoint
 * @param categoryId - The ID of the category the task belongs to
 * @param taskId - The ID of the task to update
 * @param startDate - The new start date (or null to remove)
 * @param startTime - The new start time (or null to remove)
 */
export const updateTaskStartAPI = async (
    categoryId: string,
    taskId: string,
    startDate: Date | null,
    startTime?: Date | null
): Promise<void> => {
    const { error } = await client.PATCH("/v1/user/category/{category}/task/{id}/start", {
        params: withAuthHeaders({ 
            path: { category: categoryId, id: taskId } 
        }),
        body: { 
            startDate: startDate?.toISOString() || null,
            startTime: startTime?.toISOString() || null
        },
    });

    if (error) {
        throw new Error(`Failed to update task start date/time: ${JSON.stringify(error)}`);
    }
};

/**
 * Update task reminders using specialized endpoint
 * @param categoryId - The ID of the category the task belongs to
 * @param taskId - The ID of the task to update
 * @param reminders - Array of reminder objects
 */
export const updateTaskRemindersAPI = async (
    categoryId: string,
    taskId: string,
    reminders: any[]
): Promise<void> => {
    const { error } = await client.PATCH("/v1/user/category/{category}/task/{id}/reminders", {
        params: withAuthHeaders({ 
            path: { category: categoryId, id: taskId } 
        }),
        body: { reminders },
    });

    if (error) {
        throw new Error(`Failed to update task reminders: ${JSON.stringify(error)}`);
    }
};
