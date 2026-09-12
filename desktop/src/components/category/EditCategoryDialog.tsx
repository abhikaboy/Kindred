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
import { CATEGORY_AUTH, useUpdateCategory } from "@/hooks/useCategoryActions";
import type { CategoryDocument } from "@/hooks/useWorkspaces";

export function EditCategoryDialog({
  open,
  onOpenChange,
  category,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: CategoryDocument;
}) {
  const updateCategory = useUpdateCategory();
  const [name, setName] = useState(category.name);

  useEffect(() => {
    if (!open) return;
    setName(category.name);
  }, [open, category]);

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && trimmed !== category.name;

  const submit = async () => {
    if (!canSave) return;
    try {
      await updateCategory.mutateAsync({
        params: { header: CATEGORY_AUTH, path: { id: category.id } },
        body: { name: trimmed },
      });
      toast.success(`Category renamed to "${trimmed}"`);
      onOpenChange(false);
    } catch {
      toast.error("Failed to rename category. Please try again.");
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
          <DialogTitle>Rename category</DialogTitle>
          <DialogDescription>Give this category a new name.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category-name">Name</Label>
          <Input
            id="category-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <PrimaryButton
            title={updateCategory.isPending ? "Saving…" : "Save"}
            onClick={submit}
            disabled={!canSave || updateCategory.isPending}
            className="w-auto px-4 py-2"
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
