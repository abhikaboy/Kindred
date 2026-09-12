import { useEffect, useMemo, useState } from "react";
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
import { useCreateWorkspace, CREATE_AUTH, PROXY_CATEGORY_NAME } from "@/hooks/useCreateActions";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { WorkspaceIconPicker } from "@/components/workspace/WorkspaceIconPicker";
import type { CreateWorkspaceDialogProps } from "@/components/create/types";

export function CreateWorkspaceDialog(props: CreateWorkspaceDialogProps) {
  const { open, onOpenChange, onCreated } = props;
  const { data: workspaces } = useWorkspaces();
  const createWorkspace = useCreateWorkspace();

  const workspaceNames = useMemo(
    () => new Set((workspaces ?? []).map((ws) => ws.name.toLowerCase())),
    [workspaces]
  );

  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);

  // Reset field state each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setName("");
    setIcon(null);
    setColor(null);
  }, [open]);

  const trimmed = name.trim();
  const nameTaken = trimmed.length > 0 && workspaceNames.has(trimmed.toLowerCase());
  const canCreate = trimmed.length > 0 && !nameTaken && !createWorkspace.isPending;

  const submit = () => {
    if (!canCreate) return;
    createWorkspace.mutate(
      {
        params: { header: CREATE_AUTH },
        body: {
          name: PROXY_CATEGORY_NAME,
          workspaceName: trimmed,
          icon: icon ?? undefined,
          color: color ?? undefined,
        },
      },
      {
        onSuccess: () => onCreated?.(trimmed),
      }
    );
    onOpenChange(false);
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
          <DialogTitle>New workspace</DialogTitle>
          <DialogDescription>
            Workspaces group related categories, like a project or area of life.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="workspace-name">Name</Label>
            <div className="flex items-stretch gap-2">
              <Input
                id="workspace-name"
                autoFocus
                value={name}
                placeholder="e.g. Home"
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
            title="Create"
            onClick={submit}
            disabled={!canCreate}
            className="w-auto px-4 py-2"
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
