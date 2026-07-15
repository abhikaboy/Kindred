import { useEffect, useMemo, useState } from "react";
import { Check } from "@phosphor-icons/react";
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
import { ThemedText } from "@/components/ThemedText";
import { useCreateCategory, CREATE_AUTH } from "@/hooks/useCreateActions";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import type { CreateCategoryDialogProps } from "@/components/create/types";
import { cn } from "@/lib/utils";

const SWATCHES = [
  "#7C5CFC",
  "#3B82F6",
  "#22C55E",
  "#F59E0B",
  "#EF4444",
  "#14B8A6",
  "#EC4899",
  "#64748B",
];

export function CreateCategoryDialog(props: CreateCategoryDialogProps) {
  const { open, onOpenChange, initialWorkspaceName, onCreated } = props;
  const { data: workspaces } = useWorkspaces();
  const createCategory = useCreateCategory();

  const workspaceNames = useMemo(
    () => (workspaces ?? []).map((ws) => ws.name),
    [workspaces]
  );

  const [name, setName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [color, setColor] = useState<string | undefined>(undefined);

  // Reset field state each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setName("");
    setColor(undefined);
    setWorkspaceName(initialWorkspaceName ?? workspaceNames[0] ?? "");
  }, [open, initialWorkspaceName, workspaceNames]);

  const canCreate = name.trim().length > 0 && workspaceName.length > 0;

  const submit = () => {
    if (!canCreate) return;
    createCategory.mutate(
      {
        params: { header: CREATE_AUTH },
        body: { name: name.trim(), workspaceName, color },
      },
      {
        onSuccess: (data) =>
          onCreated?.({
            id: data.id,
            name: data.name,
            workspaceName: data.workspaceName,
          }),
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
          <DialogTitle>New category</DialogTitle>
          <DialogDescription>
            Group tasks under a named list in a workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              autoFocus
              value={name}
              placeholder="e.g. Errands"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category-workspace">Workspace</Label>
            <select
              id="category-workspace"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {workspaceNames.map((ws) => (
                <option key={ws} value={ws}>
                  {ws}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <ThemedText type="smallerDefault" className="font-medium">
              Color
            </ThemedText>
            <div className="flex flex-wrap gap-2">
              {SWATCHES.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  aria-label={hex}
                  aria-pressed={color === hex}
                  onClick={() => setColor((c) => (c === hex ? undefined : hex))}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full transition-transform hover:scale-105",
                    color === hex && "ring-2 ring-ring ring-offset-2 ring-offset-popover"
                  )}
                  style={{ backgroundColor: hex }}
                >
                  {color === hex && <Check size={14} weight="bold" color="#fff" />}
                </button>
              ))}
            </div>
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
