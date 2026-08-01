import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PrimaryButton from "@/components/PrimaryButton";
import { WorkspaceIconPicker } from "@/components/workspace/WorkspaceIconPicker";
import { useWorkspaces, type WorkspaceResult } from "@/hooks/useWorkspaces";
import { AUTH_HEADER, useRenameWorkspace, useUpdateWorkspaceMeta } from "@/hooks/useWorkspaceActions";

export function EditWorkspaceDialog({
  open,
  onOpenChange,
  workspace,
  onRenamed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: WorkspaceResult;
  // Called with the new name after a successful rename, so the caller can
  // navigate to the new /workspace/:name route.
  onRenamed?: (newName: string) => void;
}) {
  const { data: workspaces } = useWorkspaces();
  const renameWorkspace = useRenameWorkspace();
  const updateMeta = useUpdateWorkspaceMeta();

  const [name, setName] = useState(workspace.name);
  const [icon, setIcon] = useState<string | null>(workspace.icon ?? null);
  const [color, setColor] = useState<string | null>(workspace.color ?? null);

  useEffect(() => {
    if (!open) return;
    setName(workspace.name);
    setIcon(workspace.icon ?? null);
    setColor(workspace.color ?? null);
  }, [open, workspace]);

  const trimmed = name.trim();
  const nameChanged = trimmed !== workspace.name;
  const iconChanged = icon !== (workspace.icon ?? null);
  const colorChanged = color !== (workspace.color ?? null);
  const nameTaken =
    nameChanged && (workspaces ?? []).some((ws) => ws.name.toLowerCase() === trimmed.toLowerCase());
  const canSave = trimmed.length > 0 && !nameTaken && (nameChanged || iconChanged || colorChanged);
  const pending = renameWorkspace.isPending || updateMeta.isPending;

  const submit = async () => {
    if (!canSave) return;
    try {
      if (nameChanged) {
        await renameWorkspace.mutateAsync({
          params: { header: AUTH_HEADER, path: { oldName: workspace.name } },
          body: { newName: trimmed },
        });
      }
      if (iconChanged || colorChanged) {
        await updateMeta.mutateAsync({
          params: { header: AUTH_HEADER, path: { name: nameChanged ? trimmed : workspace.name } },
          body: { icon: icon ?? undefined, color: color ?? undefined },
        });
      }
      toast.success(nameChanged ? `Workspace renamed to "${trimmed}"` : "Workspace updated");
      onOpenChange(false);
      if (nameChanged) onRenamed?.(trimmed);
    } catch {
      toast.error("Failed to update workspace. Please try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Edit workspace</DialogTitle>
          <DialogDescription>Rename it or change its icon and color.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="workspace-name">Name</Label>
            <div className="flex items-stretch gap-2">
              <Input
                id="workspace-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1"
              />
              <WorkspaceIconPicker
                icon={icon}
                color={color}
                onChange={(nextIcon, nextColor) => {
                  setIcon(nextIcon);
                  setColor(nextColor);
                }}
              />
            </div>
            {nameTaken && (
              <span className="text-xs text-destructive">A workspace with that name already exists.</span>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <PrimaryButton
            title={pending ? "Saving…" : "Save"}
            onClick={submit}
            disabled={!canSave || pending}
            className="w-auto px-4 py-2"
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
