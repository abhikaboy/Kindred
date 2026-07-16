import { ArrowSquareOut, Check, Play, Stop, Trash } from "@phosphor-icons/react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  AUTH_HEADER,
  useActivateTask,
  useCompleteTask,
  useDeleteTask,
} from "@/hooks/useTaskActions"
import { useCreate } from "@/components/create/CreateContext"
import type { TaskDocument } from "@/hooks/useWorkspaces"

export function TaskContextMenu({
  task,
  children,
}: {
  task: TaskDocument
  children: React.ReactNode
}): React.JSX.Element {
  const navigate = useNavigate()
  const activateTask = useActivateTask()
  const completeTask = useCompleteTask()
  const deleteTask = useDeleteTask()
  const { openCreatePost } = useCreate()

  const isActive = Boolean(task.active || task.workingOnSince)
  const hasCategoryID = Boolean(task.categoryID)

  function handleDelete() {
    if (!window.confirm("Delete this task? This cannot be undone.")) return
    deleteTask.mutate({
      params: { header: AUTH_HEADER, path: { category: task.categoryID!, id: task.id } },
    })
  }

  return (
    <ContextMenu>
      {/* Trigger renders a wrapping <div> the card fills; right-click opens the menu. */}
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => navigate(`/task/${task.id}`)}>
          <ArrowSquareOut size={14} />
          Open
        </ContextMenuItem>

        <ContextMenuItem
          disabled={!hasCategoryID}
          onClick={() =>
            activateTask.mutate({
              params: {
                header: AUTH_HEADER,
                path: { category: task.categoryID!, id: task.id },
                query: { active: isActive ? "false" : "true" },
              },
            })
          }
        >
          {isActive ? <Stop size={14} /> : <Play size={14} />}
          {isActive ? "Stop Working" : "Start Working"}
        </ContextMenuItem>

        <ContextMenuItem
          disabled={!hasCategoryID}
          onClick={() =>
            completeTask.mutate(
              {
                params: {
                  header: AUTH_HEADER,
                  path: { category: task.categoryID!, id: task.id },
                },
                body: { timeCompleted: new Date().toISOString(), timeTaken: "PT0S" },
              },
              {
                onSuccess: (data) => {
                  const title =
                    data?.streakChanged && data.currentStreak
                      ? `🔥 ${data.currentStreak} day streak!`
                      : "Task completed! 🎉"
                  toast.success(title, {
                    description: "Share your win and document your task",
                    duration: 6000,
                    action: {
                      label: "Share",
                      onClick: () =>
                        openCreatePost({ id: task.id, content: task.content, categoryId: task.categoryID }),
                    },
                  })
                },
              }
            )
          }
        >
          <Check size={14} />
          Complete
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem
          variant="destructive"
          disabled={!hasCategoryID}
          onClick={handleDelete}
        >
          <Trash size={14} />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
