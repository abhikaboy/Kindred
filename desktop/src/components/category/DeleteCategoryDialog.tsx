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
import { CATEGORY_AUTH, useDeleteCategory } from "@/hooks/useCategoryActions";

export function DeleteCategoryDialog({
  open,
  onOpenChange,
  categoryId,
  categoryName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  categoryName: string;
}) {
  const deleteCategory = useDeleteCategory();

  const confirm = async () => {
    try {
      await deleteCategory.mutateAsync({
        params: { header: CATEGORY_AUTH, path: { id: categoryId } },
      });
      toast.success(`Category "${categoryName}" deleted`);
      onOpenChange(false);
    } catch {
      toast.error("Failed to delete category. Please try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete category</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{categoryName}"? This action cannot be undone. All
            tasks in this category will be permanently deleted.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={deleteCategory.isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={deleteCategory.isPending}>
            {deleteCategory.isPending ? "Deleting…" : "Delete category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
