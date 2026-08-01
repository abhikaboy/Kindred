import { useState } from "react";
import { GearSix, PencilSimple, Trash } from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { EditWorkspaceDialog } from "@/components/workspace/EditWorkspaceDialog";
import { DeleteWorkspaceDialog } from "@/components/workspace/DeleteWorkspaceDialog";
import type { WorkspaceResult } from "@/hooks/useWorkspaces";
import { cn } from "@/lib/utils";

export function WorkspaceSettingsMenu({
  workspace,
  onRenamed,
  onDeleted,
}: {
  workspace: WorkspaceResult;
  onRenamed: (newName: string) => void;
  onDeleted: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger render={<Button variant="outline" size="icon" />}>
          <GearSix size={16} />
        </PopoverTrigger>
        <PopoverContent className="w-40 p-1">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setEditOpen(true);
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
          >
            <PencilSimple size={16} className="text-muted-foreground" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setDeleteOpen(true);
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10",
            )}
          >
            <Trash size={16} />
            Delete
          </button>
        </PopoverContent>
      </Popover>

      <EditWorkspaceDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        workspace={workspace}
        onRenamed={onRenamed}
      />
      <DeleteWorkspaceDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        workspaceName={workspace.name}
        onDeleted={onDeleted}
      />
    </>
  );
}
