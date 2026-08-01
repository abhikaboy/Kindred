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
import { AUTH_HEADER, useDeleteWorkspace } from "@/hooks/useWorkspaceActions";

export function DeleteWorkspaceDialog({
  open,
  onOpenChange,
  workspaceName,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceName: string;
  onDeleted: () => void;
}) {
  const deleteWorkspace = useDeleteWorkspace();

  const confirm = async () => {
    try {
      await deleteWorkspace.mutateAsync({
        params: { header: AUTH_HEADER, path: { name: workspaceName } },
      });
      toast.success(`Workspace "${workspaceName}" deleted`);
      onOpenChange(false);
      onDeleted();
    } catch {
      toast.error("Failed to delete workspace. Please try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete workspace</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{workspaceName}"? This action cannot be undone. All
            categories and tasks in this workspace will be permanently deleted.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={deleteWorkspace.isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={deleteWorkspace.isPending}>
            {deleteWorkspace.isPending ? "Deleting…" : "Delete workspace"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
