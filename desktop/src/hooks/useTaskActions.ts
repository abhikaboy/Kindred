import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { $api } from "@/lib/api/query";
import type { components } from "@/lib/api/types.gen";

type TaskDocument = components["schemas"]["TaskDocument"];
type UpdateTaskDocument = components["schemas"]["UpdateTaskDocument"];

// Types require an Authorization header; the client middleware fills the real token.
const AUTH = { Authorization: "" };

// Both task trees ("/" flat list + workspace tree) refetch after any mutation so
// completed/edited tasks update. Prefix match ignores the params in the query key.
function invalidateTasks(qc: QueryClient): void {
  qc.invalidateQueries({ queryKey: ["get", "/v1/user/workspaces"] });
  qc.invalidateQueries({ queryKey: ["get", "/v1/tasks/"] });
}

// PATCH /v1/user/tasks/{category}/{id} is a full replacement — carry over every
// required field, overlay the edited ones.
export function taskToUpdateDocument(
  task: TaskDocument,
  patch: Partial<UpdateTaskDocument>
): UpdateTaskDocument {
  return {
    active: task.active,
    blueprintId: task.blueprintId,
    checklist: task.checklist,
    content: task.content,
    deadline: task.deadline,
    integration: task.integration,
    notes: task.notes,
    priority: task.priority,
    public: task.public,
    recurDetails: task.recurDetails ?? ({} as UpdateTaskDocument["recurDetails"]),
    recurFrequency: task.recurFrequency,
    recurType: task.recurType,
    recurring: task.recurring,
    reminders: task.reminders,
    startDate: task.startDate,
    startTime: task.startTime,
    templateID: task.templateID,
    value: task.value,
    ...patch,
  };
}

// Each hook returns the raw react-query mutation. Callers pass the standard
// openapi variables and may add their own onSuccess (confetti, navigation):
//   completeTask.mutate(
//     { params: { header: AUTH_HEADER, path: { category, id } },
//       body: { timeCompleted: new Date().toISOString(), timeTaken: "PT0S" } },
//     { onSuccess: () => fireConfetti(el) },
//   );
export const AUTH_HEADER = AUTH;

export function useCompleteTask() {
  const qc = useQueryClient();
  return $api.useMutation("post", "/v1/user/tasks/complete/{category}/{id}", {
    onSuccess: () => invalidateTasks(qc),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return $api.useMutation("patch", "/v1/user/tasks/{category}/{id}", {
    onSuccess: () => invalidateTasks(qc),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return $api.useMutation("delete", "/v1/user/tasks/{category}/{id}", {
    onSuccess: () => invalidateTasks(qc),
  });
}

export function useActivateTask() {
  const qc = useQueryClient();
  return $api.useMutation("post", "/v1/user/tasks/active/{category}/{id}", {
    onSuccess: () => invalidateTasks(qc),
  });
}
