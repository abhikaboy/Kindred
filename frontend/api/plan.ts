import client from "@/api/client";
import type { components } from "./generated/types";
import { withAuthHeaders } from "./utils";

// Grace APIs for waiting tasks: soft plans, parking, and recoverable release.
// None of these are gated on AI credits or subscription.

type TaskDocument = components["schemas"]["TaskDocument"];
export type TaskPlan = components["schemas"]["TaskPlan"];
export type PlanSize = "2m" | "10m" | "full";
export type ReleaseItem = { categoryId: string; taskId: string };

const taskPath = (categoryId: string, taskId: string) => ({ path: { category: categoryId, id: taskId } });

const fail = (what: string, error: unknown) => new Error(`Failed to ${what}: ${JSON.stringify(error)}`);

/** Sets a soft plan: moves the task to `at`, adds `steps` to its checklist, and schedules one gentle reminder. */
export const setTaskPlanAPI = async (
    categoryId: string,
    taskId: string,
    plan: { step: string; size: PlanSize; at: Date; steps?: string[] }
): Promise<TaskDocument> => {
    const { data, error } = await client.PUT("/v1/user/tasks/{category}/{id}/plan" as any, {
        params: withAuthHeaders(taskPath(categoryId, taskId)),
        body: { step: plan.step, size: plan.size, at: plan.at.toISOString(), steps: plan.steps },
    });
    if (error) throw fail("set plan", error);
    return data as unknown as TaskDocument;
};

export const clearTaskPlanAPI = async (categoryId: string, taskId: string): Promise<TaskDocument> => {
    const { data, error } = await client.DELETE("/v1/user/tasks/{category}/{id}/plan" as any, {
        params: withAuthHeaders(taskPath(categoryId, taskId)),
    });
    if (error) throw fail("clear plan", error);
    return data as unknown as TaskDocument;
};

const postTaskAction = async (action: "park" | "unpark" | "release" | "unrelease", categoryId: string, taskId: string) => {
    const { error } = await client.POST(`/v1/user/tasks/{category}/{id}/${action}` as any, {
        params: withAuthHeaders(taskPath(categoryId, taskId)),
    });
    if (error) throw fail(action, error);
};

export const parkTaskAPI = (categoryId: string, taskId: string) => postTaskAction("park", categoryId, taskId);
export const unparkTaskAPI = (categoryId: string, taskId: string) => postTaskAction("unpark", categoryId, taskId);
export const releaseTaskAPI = (categoryId: string, taskId: string) => postTaskAction("release", categoryId, taskId);
export const unreleaseTaskAPI = (categoryId: string, taskId: string) => postTaskAction("unrelease", categoryId, taskId);

export const releaseTasksBulkAPI = async (
    tasks: ReleaseItem[]
): Promise<{ released: number; failedTaskIds: string[] }> => {
    const { data, error } = await client.POST("/v1/user/tasks/release-bulk" as any, {
        params: withAuthHeaders({}),
        body: { tasks },
    });
    if (error) throw fail("release tasks", error);
    const out = data as any;
    return { released: out?.released ?? 0, failedTaskIds: out?.failedTaskIds ?? [] };
};

export const getReleasedTasksAPI = async (): Promise<TaskDocument[]> => {
    const { data, error } = await client.GET("/v1/user/tasks/released" as any, {
        params: withAuthHeaders({}),
    });
    if (error) throw fail("load released tasks", error);
    return ((data as any)?.tasks ?? []) as TaskDocument[];
};

/** AI breakdown for a task. Returns an empty list on any failure so planning never blocks on AI. */
export const getBreakdownSuggestionsAPI = async (
    categoryId: string,
    taskId: string,
    size: PlanSize
): Promise<{ steps: string[]; whenHint?: string }> => {
    try {
        const { data, error } = await client.POST("/v1/user/tasks/{category}/{id}/breakdown-suggestions" as any, {
            params: withAuthHeaders(taskPath(categoryId, taskId)),
            body: { size },
        });
        if (error) return { steps: [] };
        const out = data as any;
        return { steps: out?.steps ?? [], whenHint: out?.whenHint };
    } catch {
        return { steps: [] };
    }
};

/** Tells the server the Welcome back sheet was shown. Fire-and-forget: never throws. */
export const markReturnedAPI = async (gapDays: number): Promise<void> => {
    try {
        await client.POST("/v1/user/returned" as any, {
            params: withAuthHeaders({}),
            body: { gapDays: Math.max(0, Math.round(gapDays)) },
        });
    } catch {
        // Best effort only.
    }
};

/** Moves a task to Someday: clears its dates and plan, keeps it in its workspace. */
export const setTaskSomedayAPI = async (categoryId: string, taskId: string, steps?: string[]): Promise<TaskDocument> => {
    const { data, error } = await client.POST("/v1/user/tasks/{category}/{id}/someday" as any, {
        params: withAuthHeaders(taskPath(categoryId, taskId)),
        body: steps?.length ? { steps } : {},
    });
    if (error) throw fail("save for someday", error);
    return data as unknown as TaskDocument;
};

export const clearTaskSomedayAPI = async (categoryId: string, taskId: string): Promise<TaskDocument> => {
    const { data, error } = await client.DELETE("/v1/user/tasks/{category}/{id}/someday" as any, {
        params: withAuthHeaders(taskPath(categoryId, taskId)),
    });
    if (error) throw fail("clear someday", error);
    return data as unknown as TaskDocument;
};

export const getSomedayTasksAPI = async (): Promise<TaskDocument[]> => {
    const { data, error } = await client.GET("/v1/user/tasks/someday" as any, { params: withAuthHeaders({}) });
    if (error) throw fail("load someday tasks", error);
    return ((data as any)?.tasks ?? []) as TaskDocument[];
};
