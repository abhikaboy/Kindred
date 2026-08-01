import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AUTH_HEADER, useDeleteTask } from "@/hooks/useTaskActions";
import type { TaskDocument } from "@/hooks/useWorkspaces";

// Mirrors mobile's useUndoableDelete: a task with a templateID is one occurrence
// of a recurring series, so ask whether to stop the whole series or just this one.
export function DeleteTaskDialog({
  task,
  open,
  onOpenChange,
  onDeleted,
}: {
  task: TaskDocument;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const deleteTask = useDeleteTask();
  const isRecurring = Boolean(task.templateID);

  const confirm = (deleteRecurring: boolean) => {
    deleteTask.mutate(
      {
        params: {
          header: AUTH_HEADER,
          path: { category: task.categoryID!, id: task.id },
          query: deleteRecurring ? { deleteRecurring: true } : undefined,
        },
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          onDeleted?.();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isRecurring ? "Delete recurring task" : "Delete task"}</DialogTitle>
          <DialogDescription>
            {isRecurring
              ? "This task repeats. Delete only this occurrence, or stop all future occurrences too?"
              : "This action cannot be undone."}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={deleteTask.isPending}>
            Cancel
          </Button>
          {isRecurring ? (
            <>
              <Button variant="outline" onClick={() => confirm(false)} disabled={deleteTask.isPending}>
                Only This Task
              </Button>
              <Button variant="destructive" onClick={() => confirm(true)} disabled={deleteTask.isPending}>
                All Future Tasks
              </Button>
            </>
          ) : (
            <Button variant="destructive" onClick={() => confirm(false)} disabled={deleteTask.isPending}>
              {deleteTask.isPending ? "Deleting…" : "Delete"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
