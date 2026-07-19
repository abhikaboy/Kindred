import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent, type JSX } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ImageSquare, X } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { $api } from "@/lib/api/query";
import { cn } from "@/lib/utils";
import { uploadImage } from "@/lib/upload";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useCreatePost } from "@/hooks/useCreatePost";
import { useAuth } from "@/contexts/auth";
import { showPostSharedToast } from "@/components/feed/PostSharedToast";
import { formatNotificationTime } from "@/lib/notifications";

const AUTH = { Authorization: "" };

function pickImageFile(items: DataTransferItemList | FileList | null): File | null {
  if (!items) return null;
  for (const item of Array.from(items as ArrayLike<DataTransferItem | File>)) {
    const file = "getAsFile" in item ? item.getAsFile() : (item as File);
    if (file && file.type.startsWith("image/")) return file;
  }
  return null;
}

// A just-completed task to share — pre-selects it so the picker starts collapsed.
export type PostPrefill = { id: string; content: string; categoryId?: string };

export function CreatePostModal({
  open,
  onClose,
  prefill,
}: {
  open: boolean;
  onClose: () => void;
  prefill?: PostPrefill;
}): JSX.Element | null {
  const navigate = useNavigate();
  const { user } = useAuth();
  const workspaces = useWorkspaces();
  const create = useCreatePost();
  const completed = $api.useQuery(
    "get",
    "/v1/user/tasks/completed",
    { params: { header: AUTH, query: { page: 1, limit: 20 } } },
    { enabled: open }
  );

  const [taskId, setTaskId] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!open) {
      setTaskId(null);
      setCaption("");
      setIsPublic(true);
      setFile(null);
      setExpanded(false);
    }
  }, [open]);

  // Pre-select the just-completed task when opened from the post-complete prompt.
  useEffect(() => {
    if (open && prefill) {
      setTaskId(prefill.id);
      setExpanded(false);
    }
  }, [open, prefill]);

  const rawTasks = completed.data?.tasks ?? [];
  // The just-completed task may not be in the cached "completed" list yet — inject it
  // so it can be selected and posted immediately.
  const tasks = useMemo(() => {
    if (prefill && !rawTasks.some((t) => t.id === prefill.id)) {
      return [
        {
          id: prefill.id,
          content: prefill.content,
          categoryID: prefill.categoryId ?? "",
          timeCompleted: new Date().toISOString(),
        } as (typeof rawTasks)[number],
        ...rawTasks,
      ];
    }
    return rawTasks;
  }, [rawTasks, prefill]);

  if (!open) return null;

  const catName = (id?: string): string => {
    if (!id) return "";
    for (const ws of workspaces.data ?? []) for (const c of ws.categories ?? []) if (c.id === id) return c.name;
    return "";
  };
  const taskMeta = (t: (typeof tasks)[number]): string =>
    [catName(t.categoryID), t.timeCompleted && formatNotificationTime(new Date(t.timeCompleted).getTime())]
      .filter(Boolean)
      .join(" · ");
  const selectedTask = tasks.find((t) => t.id === taskId);
  const showList = expanded || !selectedTask;

  const onPaste = (e: ClipboardEvent) => {
    const img = pickImageFile(e.clipboardData.items);
    if (img) setFile(img);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const img = pickImageFile(e.dataTransfer.files);
    if (img) setFile(img);
  };

  const submit = async () => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    setSubmitting(true);
    try {
      let images: string[] = [];
      if (file) {
        const url = await uploadImage(file, "post", `post-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        images = [url];
      }
      const categoryName = catName(task.categoryID);
      await create.mutateAsync({
        params: { header: AUTH },
        body: {
          caption: caption.trim(),
          isPublic,
          images,
          task: { id: task.id, content: task.content, category: { id: task.categoryID ?? "", name: categoryName } },
        },
      });
      onClose();
      showPostSharedToast({
        preview: {
          authorName: user?.display_name ?? "You",
          authorAvatar: user?.profile_picture,
          taskLabel: [categoryName, task.content].filter(Boolean).join(" · "),
          caption: caption.trim(),
          image: images[0],
        },
        onView: () => navigate("/feed"),
      });
    } catch (err) {
      if (err instanceof Error) toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in-0 duration-200"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200"
        onClick={(e) => e.stopPropagation()}
        onPaste={onPaste}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <div className="shrink-0">
          <ThemedText type="subtitle" as="h2">
            Share a win
          </ThemedText>
          <ThemedText type="caption" as="p" className="mt-1">
            Posts celebrate a task you finished.
          </ThemedText>
        </div>

        {/* Compact, capped task picker so the caption + image get the room. */}
        <div className="mt-4 shrink-0">
          <ThemedText type="caption" className="mb-2 block uppercase tracking-wide">
            Which task?
          </ThemedText>
          {completed.isLoading ? (
            <ThemedText type="caption" className="text-muted-foreground">
              Loading…
            </ThemedText>
          ) : tasks.length === 0 ? (
            <ThemedText type="caption" className="text-muted-foreground">
              Complete a task first, then you can share it.
            </ThemedText>
          ) : !showList && selectedTask ? (
            // Collapsed: just the chosen task, with a Change affordance.
            <div className="flex items-center gap-2 rounded-xl border border-primary bg-primary/5 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <ThemedText type="defaultSemiBold" className="block truncate">
                  {selectedTask.content || "Untitled task"}
                </ThemedText>
                <ThemedText type="caption" className="block truncate text-muted-foreground">
                  {taskMeta(selectedTask)}
                </ThemedText>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="shrink-0 text-sm text-primary hover:underline"
              >
                Change
              </button>
            </div>
          ) : (
            // Roomy rows, but only ~4 tall — the rest scroll.
            <div className="flex max-h-[15rem] flex-col gap-2 overflow-y-auto pr-1">
              {tasks.map((t) => {
                const selected = t.id === taskId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTaskId(t.id);
                      setExpanded(false);
                    }}
                    className={cn(
                      "flex flex-col rounded-xl border px-3 py-2.5 text-left transition-colors",
                      selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                    )}
                  >
                    <ThemedText type="defaultSemiBold" className="truncate">
                      {t.content || "Untitled task"}
                    </ThemedText>
                    <ThemedText type="caption" className="truncate text-muted-foreground">
                      {taskMeta(t)}
                    </ThemedText>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* The main event: a big caption box + a big image area. */}
        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Say something about it…"
            className="min-h-40 w-full flex-1 resize-none rounded-xl border bg-background p-4 text-foreground outline-none focus:border-primary transition-colors"
          />

          {preview ? (
            <div className="relative shrink-0">
              <img src={preview} alt="" className="max-h-72 w-full rounded-xl object-cover" />
              <button
                type="button"
                aria-label="Remove image"
                onClick={() => setFile(null)}
                className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
              >
                <X size={16} weight="bold" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed py-8 text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              <ImageSquare size={24} />
              <ThemedText type="caption">Click to upload — or paste / drag an image (optional)</ThemedText>
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setFile(f);
              e.target.value = ""; // allow re-selecting the same file
            }}
          />
        </div>

        <div className="mt-4 flex shrink-0 items-center justify-between">
          <label className="flex items-center gap-2">
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            <ThemedText type="caption">{isPublic ? "Public" : "Friends only"}</ThemedText>
          </label>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" disabled={!taskId || submitting} onClick={submit}>
              {submitting ? "Sharing…" : "Share"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreatePostModal;
