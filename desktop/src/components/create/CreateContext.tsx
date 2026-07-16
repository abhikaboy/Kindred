import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CreateTaskDialog } from "@/components/create/CreateTaskDialog";
import { CreateCategoryDialog } from "@/components/create/CreateCategoryDialog";
import type { SelectedCategory, TaskPrefill } from "@/components/create/types";

type CreateContextValue = {
  openCreateTask: (prefill?: TaskPrefill) => void;
  openCreateCategory: (workspaceName?: string) => void;
  // Opens the category dialog primed for a NEW workspace (workspaces are created
  // by adding their first category under a new name — there's no standalone flow).
  openCreateWorkspace: () => void;
  // Screens with an ordered category list register it here for the Shift+1..9 hotkeys.
  setCategoryShortcuts: (categories: { id: string }[]) => void;
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

// Maps a physical number-row key code to a 0-based category index (Digit1 -> 0).
// Uses e.code, not e.key: Shift+2 emits "@" in e.key on US layouts, but "Digit2" in e.code.
export function shortcutCategoryIndex(code: string): number | null {
  const m = /^Digit([1-9])$/.exec(code);
  return m ? Number(m[1]) - 1 : null;
}

export function CreateProvider({ children }: { children: React.ReactNode }) {
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskPrefill, setTaskPrefill] = useState<TaskPrefill | undefined>();

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryWorkspace, setCategoryWorkspace] = useState<string | undefined>();
  // Inline-create callback: set when the task dialog requests a new category.
  const categoryOnCreated = useRef<((cat: SelectedCategory) => void) | undefined>(undefined);
  // Ordered ids of the categories currently on screen, for the Shift+1..9 hotkeys.
  const shortcutCategoriesRef = useRef<{ id: string }[]>([]);
  const setCategoryShortcuts = useCallback((cats: { id: string }[]) => {
    shortcutCategoriesRef.current = cats;
  }, []);

  const openCreateTask = useCallback((prefill?: TaskPrefill) => {
    setTaskPrefill(prefill);
    setTaskOpen(true);
  }, []);

  const openCreateCategory = useCallback((workspaceName?: string) => {
    categoryOnCreated.current = undefined;
    setCategoryWorkspace(workspaceName);
    setCategoryOpen(true);
  }, []);

  const openCreateWorkspace = useCallback(() => {
    categoryOnCreated.current = undefined;
    setCategoryWorkspace(""); // empty workspace field -> user names a new workspace
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
      if (!e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      // Shift+T -> new task
      if (e.code === "KeyT") {
        e.preventDefault();
        openCreateTask();
        return;
      }
      // Shift+W -> new workspace
      if (e.code === "KeyW") {
        e.preventDefault();
        openCreateWorkspace();
        return;
      }
      // Shift+1..9 -> new task in the Nth on-screen category
      const idx = shortcutCategoryIndex(e.code);
      const cat = idx !== null ? shortcutCategoriesRef.current[idx] : undefined;
      if (cat) {
        e.preventDefault();
        openCreateTask({ categoryId: cat.id });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [anyOpen, openCreateTask, openCreateWorkspace]);

  return (
    <CreateContext.Provider value={{ openCreateTask, openCreateCategory, openCreateWorkspace, setCategoryShortcuts }}>
      {children}
      <CreateTaskDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        prefill={taskPrefill}
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
