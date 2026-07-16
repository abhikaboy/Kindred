import { createContext, useContext, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { TaskEditor } from "@/components/task/TaskEditor";
import type { TaskDocument } from "@/hooks/useWorkspaces";

type PeekState = { task: TaskDocument; categoryId: string } | null;
const TaskPeekContext = createContext<{ openTask: (task: TaskDocument) => void } | null>(null);

export function useTaskPeek() {
  const c = useContext(TaskPeekContext);
  if (!c) throw new Error("useTaskPeek must be used within TaskPeekProvider");
  return c;
}

export function TaskPeekProvider({ children }: { children: React.ReactNode }) {
  const [peek, setPeek] = useState<PeekState>(null);

  // Calendar tasks from useAllTasks() stamp categoryID on each task.
  const openTask = (task: TaskDocument) => {
    if (!task.categoryID) return;
    setPeek({ task, categoryId: task.categoryID });
  };

  return (
    <TaskPeekContext.Provider value={{ openTask }}>
      {children}
      <Sheet open={!!peek} onOpenChange={(o) => { if (!o) setPeek(null); }}>
        {peek && (
          <SheetContent side="right" className="w-[440px] overflow-y-auto px-6 sm:max-w-md">
            <TaskEditor
              key={peek.task.id}
              task={peek.task}
              categoryId={peek.categoryId}
              onDone={() => setPeek(null)}
              showBackLink={false}
            />
          </SheetContent>
        )}
      </Sheet>
    </TaskPeekContext.Provider>
  );
}
