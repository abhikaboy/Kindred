// Shared contract between CreateContext and the two create dialogs.

export type SelectedCategory = {
  id: string;
  name: string;
  workspaceName: string;
};

export type TaskPrefill = {
  categoryId?: string;
  deadline?: string;
  startDate?: string;
  startTime?: string;
  // Open the dialog directly in AI mode (sidebar "Create with AI" / ⇧A).
  ai?: boolean;
};

export type CreateTaskDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Prefill data (category, deadline, start time) when the dialog opens.
  prefill?: TaskPrefill;
  // Opens the category dialog inline; onCreated fires with the real created
  // category so the task form can select it (real id, post-server).
  onRequestNewCategory: (
    workspaceName: string | undefined,
    onCreated: (cat: SelectedCategory) => void
  ) => void;
};

export type CreateCategoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialWorkspaceName?: string;
  // Fired in the create mutation's onSuccess with the real server category.
  onCreated?: (cat: SelectedCategory) => void;
};
