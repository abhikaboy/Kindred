import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { $api } from "@/lib/api/query";
import type { components } from "@/lib/api/types.gen";

type CreateTaskParams = components["schemas"]["CreateTaskParams"];
type CreateCategoryParams = components["schemas"]["CreateCategoryParams"];
type TaskDocument = components["schemas"]["TaskDocument"];
type CategoryDocument = components["schemas"]["CategoryDocument"];
type WorkspaceResult = components["schemas"]["WorkspaceResult"];
type RecurDetails = components["schemas"]["RecurDetails"];
type Reminder = components["schemas"]["Reminder"];

const AUTH = { Authorization: "" };
const WORKSPACES_KEY = ["get", "/v1/user/workspaces"] as const;

function invalidateTasks(qc: QueryClient): void {
  qc.invalidateQueries({ queryKey: WORKSPACES_KEY });
  qc.invalidateQueries({ queryKey: ["get", "/v1/tasks/"] });
}

// ---- Form state (contract shared with CreateTaskDialog) ----

export type TaskFormState = {
  content: string;
  notes: string;
  priority: number; // 0 none, 1 low, 2 med, 3 high
  value: number; // difficulty 1-5
  isPublic: boolean;
  deadline: string | null; // ISO
  startDate: string | null; // ISO
  startTime: string | null; // ISO
  recurring: boolean;
  recurFrequency: string; // daily | weekly | monthly | yearly
  every: number;
  daysOfWeek: number[]; // length 7, 0/1 (Sun..Sat)
  behavior: "ROLLING" | "BUILDUP";
  flex: { target: number; period: string } | null; // period: daily | weekly | monthly
  reminders: { triggerTime: string }[];
  integration: string; // "" = none
  taggedUserIds: string[];
};

export const emptyTaskForm = (): TaskFormState => ({
  content: "",
  notes: "",
  priority: 0,
  value: 1,
  isPublic: false,
  deadline: null,
  startDate: null,
  startTime: null,
  recurring: false,
  recurFrequency: "daily",
  every: 1,
  daysOfWeek: [0, 0, 0, 0, 0, 0, 0],
  behavior: "ROLLING",
  flex: null,
  reminders: [],
  integration: "",
  taggedUserIds: [],
});

// Absolute reminder with sane defaults; only triggerTime varies in the UI.
function toReminder(triggerTime: string): Reminder {
  return {
    afterDeadline: false,
    afterStart: false,
    beforeDeadline: false,
    beforeStart: false,
    sent: false,
    triggerTime,
    type: "absolute",
    vibration: true,
  };
}

// Pure: form state -> POST body. Owns the recurrence/flex assembly and optional
// omission. Unit-tested in useCreateActions.test.ts.
export function buildCreateTaskParams(form: TaskFormState): CreateTaskParams {
  const recurring = form.recurring || !!form.flex;

  const body: CreateTaskParams = {
    content: form.content.trim(),
    priority: form.priority,
    public: form.isPublic,
    recurring,
    value: form.value,
    active: false,
  };

  if (form.notes.trim()) body.notes = form.notes.trim();
  if (form.deadline) body.deadline = form.deadline;
  if (form.startDate) body.startDate = form.startDate;
  if (form.startTime) body.startTime = form.startTime;
  if (form.integration) body.integration = form.integration;
  if (form.taggedUserIds.length > 0) body.taggedUserIds = form.taggedUserIds;
  if (form.reminders.length > 0)
    body.reminders = form.reminders.map((r) => toReminder(r.triggerTime));

  if (recurring) {
    const details: RecurDetails = {
      every: form.every,
      daysOfWeek: form.daysOfWeek,
      behavior: form.behavior,
    };
    if (form.flex) {
      details.flex = { target: form.flex.target, period: form.flex.period };
      body.recurFrequency = form.flex.period;
    } else {
      body.recurFrequency = form.recurFrequency;
    }
    body.recurDetails = details;
  }

  return body;
}

// Optimistic TaskDocument for the workspaces cache (real row replaces it on refetch).
export function buildOptimisticTask(
  body: CreateTaskParams,
  categoryId: string,
  tempId: string
): TaskDocument {
  const now = new Date().toISOString();
  return {
    ...body,
    id: tempId,
    categoryID: categoryId,
    posted: false,
    lastEdited: now,
    timestamp: now,
    startDate: body.startDate ?? now,
    active: body.active ?? false,
  };
}

function insertTaskIntoWorkspaces(
  workspaces: WorkspaceResult[] | undefined,
  categoryId: string,
  task: TaskDocument
): WorkspaceResult[] | undefined {
  if (!workspaces) return workspaces;
  return workspaces.map((ws) => ({
    ...ws,
    categories: (ws.categories ?? []).map((c) =>
      c.id === categoryId ? { ...c, tasks: [...(c.tasks ?? []), task] } : c
    ),
  }));
}

function insertCategoryIntoWorkspaces(
  workspaces: WorkspaceResult[] | undefined,
  workspaceName: string,
  category: CategoryDocument
): WorkspaceResult[] | undefined {
  if (!workspaces) return workspaces;
  return workspaces.map((ws) =>
    ws.name === workspaceName
      ? { ...ws, categories: [...(ws.categories ?? []), category] }
      : ws
  );
}

type Snapshot = [readonly unknown[], WorkspaceResult[] | undefined][];

// ---- Mutations with optimistic updates ----

export function useCreateTask() {
  const qc = useQueryClient();
  return $api.useMutation("post", "/v1/user/tasks/{category}", {
    onMutate: async (vars): Promise<{ previous: Snapshot }> => {
      const categoryId = vars.params.path.category;
      await qc.cancelQueries({ queryKey: WORKSPACES_KEY });
      const previous = qc.getQueriesData<WorkspaceResult[]>({
        queryKey: WORKSPACES_KEY,
      });
      const task = buildOptimisticTask(vars.body, categoryId, `temp-${crypto.randomUUID()}`);
      qc.setQueriesData<WorkspaceResult[]>({ queryKey: WORKSPACES_KEY }, (old) =>
        insertTaskIntoWorkspaces(old, categoryId, task)
      );
      return { previous };
    },
    onError: (_e, _vars, ctx) => {
      ctx?.previous.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => invalidateTasks(qc),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return $api.useMutation("post", "/v1/user/categories", {
    onMutate: async (vars): Promise<{ previous: Snapshot }> => {
      const now = new Date().toISOString();
      await qc.cancelQueries({ queryKey: WORKSPACES_KEY });
      const previous = qc.getQueriesData<WorkspaceResult[]>({
        queryKey: WORKSPACES_KEY,
      });
      const category: CategoryDocument = {
        id: `temp-${crypto.randomUUID()}`,
        name: vars.body.name,
        workspaceName: vars.body.workspaceName,
        tags: vars.body.tags,
        tasks: [],
        user: "",
        lastEdited: now,
      };
      qc.setQueriesData<WorkspaceResult[]>({ queryKey: WORKSPACES_KEY }, (old) =>
        insertCategoryIntoWorkspaces(old, vars.body.workspaceName, category)
      );
      return { previous };
    },
    onError: (_e, _vars, ctx) => {
      ctx?.previous.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: WORKSPACES_KEY }),
  });
}

export { AUTH as CREATE_AUTH };
export type { CreateTaskParams, CreateCategoryParams };
