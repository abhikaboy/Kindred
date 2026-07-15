import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CreateTaskDialog } from "@/components/create/CreateTaskDialog";
import { CreateCategoryDialog } from "@/components/create/CreateCategoryDialog";
import type { SelectedCategory } from "@/components/create/types";

type CreateContextValue = {
  openCreateTask: (categoryId?: string) => void;
  openCreateCategory: (workspaceName?: string) => void;
};

const CreateContext = createContext<CreateContextValue | null>(null);

export function useCreate(): CreateContextValue {
  const ctx = useContext(CreateContext);
  if (!ctx) throw new Error("useCreate must be used within CreateProvider");
  return ctx;
}

// Don't fire the global hotkey while the user is typing or a dialog is open.
function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

export function CreateProvider({ children }: { children: React.ReactNode }) {
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskCategoryId, setTaskCategoryId] = useState<string | undefined>();

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryWorkspace, setCategoryWorkspace] = useState<string | undefined>();
  // Inline-create callback: set when the task dialog requests a new category.
  const categoryOnCreated = useRef<((cat: SelectedCategory) => void) | undefined>(undefined);

  const openCreateTask = useCallback((categoryId?: string) => {
    setTaskCategoryId(categoryId);
    setTaskOpen(true);
  }, []);

  const openCreateCategory = useCallback((workspaceName?: string) => {
    categoryOnCreated.current = undefined;
    setCategoryWorkspace(workspaceName);
    setCategoryOpen(true);
  }, []);

  const requestNewCategory = useCallback(
    (workspaceName: string | undefined, onCreated: (cat: SelectedCategory) => void) => {
      categoryOnCreated.current = onCreated;
      setCategoryWorkspace(workspaceName);
      setCategoryOpen(true);
    },
    []
  );

  const anyOpen = taskOpen || categoryOpen;
  useEffect(() => {
    if (anyOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "c" && e.key !== "C") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      openCreateTask();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [anyOpen, openCreateTask]);

  return (
    <CreateContext.Provider value={{ openCreateTask, openCreateCategory }}>
      {children}
      <CreateTaskDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        initialCategoryId={taskCategoryId}
        onRequestNewCategory={requestNewCategory}
      />
      <CreateCategoryDialog
        open={categoryOpen}
        onOpenChange={setCategoryOpen}
        initialWorkspaceName={categoryWorkspace}
        onCreated={(cat) => {
          categoryOnCreated.current?.(cat);
          categoryOnCreated.current = undefined;
        }}
      />
    </CreateContext.Provider>
  );
}
