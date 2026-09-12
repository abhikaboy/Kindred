import { useState } from "react";
import { DotsThreeVertical, PencilSimple, Trash } from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { EditCategoryDialog } from "@/components/category/EditCategoryDialog";
import { DeleteCategoryDialog } from "@/components/category/DeleteCategoryDialog";
import type { CategoryDocument } from "@/hooks/useWorkspaces";
import { cn } from "@/lib/utils";

// Kebab menu for a single category, offering rename/delete. Mirrors
// WorkspaceSettingsMenu's popover + dialog pattern.
export function CategorySettingsMenu({ category }: { category: CategoryDocument }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="xs"
              className={cn(
                "text-muted-foreground opacity-0 transition-opacity group-focus-within/category:opacity-100 group-hover/category:opacity-100 focus-visible:opacity-100",
                menuOpen && "opacity-100",
              )}
              title={`Category options for ${category.name}`}
            />
          }
        >
          <DotsThreeVertical size={16} />
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
            Rename
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

      <EditCategoryDialog open={editOpen} onOpenChange={setEditOpen} category={category} />
      <DeleteCategoryDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        categoryId={category.id}
        categoryName={category.name}
      />
    </>
  );
}
