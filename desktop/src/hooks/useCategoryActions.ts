import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { $api } from "@/lib/api/query";

// Types require an Authorization header; the client middleware fills the real token.
const AUTH = { Authorization: "" };
const WORKSPACES_KEY = ["get", "/v1/user/workspaces"] as const;

// Categories and workspaces both live in the workspace tree, so refetch it after any edit.
function invalidateWorkspaces(qc: QueryClient): void {
  qc.invalidateQueries({ queryKey: WORKSPACES_KEY });
}

// Callers pass the standard openapi variables, e.g.
//   deleteCategory.mutate({ params: { header: CATEGORY_AUTH, path: { id } } });
//   renameWorkspace.mutate({ params: { header: CATEGORY_AUTH, path: { oldName } }, body: { name } });
export const CATEGORY_AUTH = AUTH;

export function useDeleteCategory() {
  const qc = useQueryClient();
  return $api.useMutation("delete", "/v1/user/categories/{id}", {
    onSuccess: () => invalidateWorkspaces(qc),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return $api.useMutation("patch", "/v1/user/categories/{id}", {
    onSuccess: () => invalidateWorkspaces(qc),
  });
}

export function useDeleteWorkspace() {
  const qc = useQueryClient();
  return $api.useMutation("delete", "/v1/user/categories/workspace/{name}", {
    onSuccess: () => invalidateWorkspaces(qc),
  });
}

export function useRenameWorkspace() {
  const qc = useQueryClient();
  return $api.useMutation("patch", "/v1/user/categories/workspace/{oldName}", {
    onSuccess: () => invalidateWorkspaces(qc),
  });
}
