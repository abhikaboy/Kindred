import { useQueryClient } from "@tanstack/react-query";
import { $api } from "@/lib/api/query";

export const AUTH_HEADER = { Authorization: "" };
const WORKSPACES_KEY = ["get", "/v1/user/workspaces"] as const;

// Delete/rename/icon-color updates all touch the same workspaces list — one
// invalidate after each covers all three.
function useInvalidateWorkspaces() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: WORKSPACES_KEY });
}

export function useDeleteWorkspace() {
  const invalidate = useInvalidateWorkspaces();
  return $api.useMutation("delete", "/v1/user/categories/workspace/{name}", {
    onSuccess: invalidate,
  });
}

export function useRenameWorkspace() {
  const invalidate = useInvalidateWorkspaces();
  return $api.useMutation("patch", "/v1/user/categories/workspace/{oldName}", {
    onSuccess: invalidate,
  });
}

export function useUpdateWorkspaceMeta() {
  const invalidate = useInvalidateWorkspaces();
  return $api.useMutation("patch", "/v1/user/workspaces/{name}", {
    onSuccess: invalidate,
  });
}
