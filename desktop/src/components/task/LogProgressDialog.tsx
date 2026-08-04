import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
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
import { AUTH_HEADER, useLogProgress } from "@/hooks/useTaskActions";
import type { TaskDocument } from "@/hooks/useWorkspaces";
import type { components } from "@/lib/api/types.gen";

type RingDelta = components["schemas"]["RingDelta"];

// v1 (manual entry only, per the Sessions proposal): duration + optional note.
// Photo attachment and Live Activity duration prefill are future iterations.
export function LogProgressDialog({
  task,
  open,
  onOpenChange,
  onLogged,
}: {
  task: TaskDocument;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogged?: (ringDelta?: RingDelta) => void;
}) {
  const qc = useQueryClient();
  const logProgress = useLogProgress();
  const [minutes, setMinutes] = useState("");
  const [note, setNote] = useState("");

  const reset = () => {
    setMinutes("");
    setNote("");
  };

  const handleSave = () => {
    const durationSeconds = Math.round(parseFloat(minutes) * 60);
    if (!durationSeconds || durationSeconds <= 0) {
      toast.error("Enter how long you worked on this");
      return;
    }

    logProgress.mutate(
      {
        params: { header: AUTH_HEADER, path: { category: task.categoryID!, id: task.id } },
        body: { durationSeconds, note: note.trim() || undefined },
      },
      {
        onSuccess: (data) => {
          qc.invalidateQueries({ queryKey: ["get", "/v1/user/tasks/{id}/progress"] });
          reset();
          onOpenChange(false);
          toast.success("Progress logged");
          onLogged?.(data?.ringDelta);
        },
        onError: () => toast.error("Failed to log progress"),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Log Progress</DialogTitle>
          <DialogDescription>Record a chunk of work on this task without completing it.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="log-progress-minutes">Minutes</Label>
            <Input
              id="log-progress-minutes"
              type="number"
              min={1}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="30"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="log-progress-note">Note (optional)</Label>
            <textarea
              id="log-progress-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What did you get done?"
              rows={3}
              className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={logProgress.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={logProgress.isPending}>
            {logProgress.isPending ? "Saving…" : "Save progress"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
