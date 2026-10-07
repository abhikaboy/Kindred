import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, ClipboardEvent, KeyboardEvent } from "react";
import { X, PencilSimple, ArrowLeft, ArrowUpRight, Image as ImageIcon, Clipboard } from "@phosphor-icons/react";
import { TaskMeta } from "@/components/task/TaskMeta";
import { toast } from "sonner";
import { ThemedText } from "@/components/ThemedText";
import {
  usePreviewTasksAI,
  useImagePreviewTasksAI,
  useConfirmTasksAI,
  buildConfirmBody,
  countPreviewTasks,
  CREATE_AUTH,
  type AiPreviewPayload,
} from "@/hooks/useCreateActions";
import type { components } from "@/lib/api/types.gen";
import type { TaskDocument } from "@/hooks/useWorkspaces";
import { getErrorMessage } from "@/lib/errors";

type CreateTaskParams = components["schemas"]["CreateTaskParams"];
type Stage = "prompt" | "loading" | "preview";

const TIMEZONE = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
})();

// Example prompts offered as one-tap starters on the empty stage (no em dashes in copy).
const PLACEHOLDERS = [
  "gym at 7am tomorrow, finish the quarterly report by friday, call the dentist",
  "plan mom's birthday dinner, book flights for the trip, renew car insurance",
  "email the client back, review the open PR, prep slides for monday standup",
  "buy groceries, water the plants, schedule a haircut this weekend",
];

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Coordinates into the editable payload: a new-category task, or an existing-category pair.
type Coord = { kind: "cat"; ci: number; ti: number } | { kind: "pair"; pi: number };

// Display-only TaskDocument so proposed tasks render via the real TaskItem.
function toDisplayTask(t: CreateTaskParams, key: string): TaskDocument {
  return {
    ...t,
    id: key,
    categoryID: "",
    posted: false,
    active: false,
    lastEdited: "",
    timestamp: "",
    startDate: t.startDate ?? "",
  } as TaskDocument;
}

function PreviewTaskRow({
  task,
  keyId,
  onEditTitle,
  onRemove,
}: {
  task: CreateTaskParams;
  keyId: string;
  onEditTitle: (content: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.content);

  // Rows are keyed by index; when a removal reuses this instance for a different
  // task, resync so a stale draft can't be committed onto the wrong task.
  useEffect(() => {
    setDraft(task.content);
    setEditing(false);
  }, [task.content]);

  const commit = () => {
    const next = draft.trim();
    if (next) onEditTitle(next);
    else setDraft(task.content);
    setEditing(false);
  };

  return (
    <div className="group flex items-start gap-3 rounded-xl bg-white/[0.06] px-4 py-3 transition-colors duration-150 animate-in fade-in slide-in-from-bottom-1 duration-300 hover:bg-white/[0.09]">
      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commit(); }
              if (e.key === "Escape") { setDraft(task.content); setEditing(false); }
            }}
            className="w-full bg-transparent font-sans font-light text-base text-foreground outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => { setDraft(task.content); setEditing(true); }}
            className="text-left"
          >
            <ThemedText type="default" className="break-words">{task.content}</ThemedText>
          </button>
        )}
        <TaskMeta task={toDisplayTask(task, keyId)} />
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-50 transition-opacity duration-150 group-hover:opacity-100">
        {!editing && (
          <button type="button" aria-label="Edit title" onClick={() => { setDraft(task.content); setEditing(true); }} className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground">
            <PencilSimple size={14} />
          </button>
        )}
        <button type="button" aria-label="Remove task" onClick={onRemove} className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

export function AiTaskPanel({ onClose }: { onClose: () => void }) {
  const [stage, setStage] = useState<Stage>("prompt");
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null); // data URL, for preview + upload
  const [payload, setPayload] = useState<AiPreviewPayload>({ categories: [], tasks: [] });
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const preview = usePreviewTasksAI();
  const imagePreview = useImagePreviewTasksAI();
  const confirm = useConfirmTasksAI();

  const canGenerate = image !== null || text.trim().length >= 4;
  const count = countPreviewTasks(payload);

  const handleImageBlob = async (blob: Blob) => {
    try {
      setImage(await readBlobAsDataUrl(blob));
      setError(null);
    } catch {
      setError("Couldn't read that image.");
    }
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (file) handleImageBlob(file);
  };

  const onPromptPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    const file = item?.getAsFile();
    if (file) {
      e.preventDefault();
      handleImageBlob(file);
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (type) {
          await handleImageBlob(await item.getType(type));
          return;
        }
      }
      setError("No image found on the clipboard.");
    } catch {
      setError("Couldn't read the clipboard. Try pasting into the box instead (Cmd+V).");
    }
  };

  const generate = () => {
    if (!canGenerate) return;
    setError(null);
    setStage("loading");
    const onSettledCommon = {
      onSuccess: (data: { categories?: AiPreviewPayload["categories"]; tasks?: AiPreviewPayload["tasks"] }) => {
        setPayload({ categories: data.categories ?? [], tasks: data.tasks ?? [] });
        setStage("preview");
      },
      onError: (e: unknown) => {
        setError(getErrorMessage(e));
        setStage("prompt");
      },
    };
    if (image) {
      const [, mimeType, base64] = image.match(/^data:(.*?);base64,(.*)$/) ?? [, "image/jpeg", image];
      imagePreview.mutate(
        { params: { header: CREATE_AUTH }, body: { image: base64, mimeType, timezone: TIMEZONE } },
        onSettledCommon,
      );
    } else {
      preview.mutate(
        { params: { header: CREATE_AUTH }, body: { text: text.trim(), timezone: TIMEZONE } },
        onSettledCommon,
      );
    }
  };

  const editTitle = (c: Coord, content: string) =>
    setPayload((p) => mutateAt(p, c, (t) => ({ ...t, content })));
  const removeAt = (c: Coord) => setPayload((p) => removeCoord(p, c));

  const create = () => {
    const body = buildConfirmBody(payload);
    confirm.mutate(
      { params: { header: CREATE_AUTH }, body },
      {
        onSuccess: (data) => {
          toast.success(data.message || `Created ${data.tasksCreated} tasks`);
          onClose();
        },
        onError: (e: unknown) => setError(getErrorMessage(e)),
      },
    );
  };

  const onPromptKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); generate(); }
  };

  if (stage === "loading") {
    return (
      <div className="flex flex-col gap-3 py-2">
        <ThemedText type="fancyFrauncesSubheading" className="text-foreground/40">
          {text.trim() || "Reading your image"}
        </ThemedText>
        <div className="mt-2 flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-xl bg-white/[0.06]"
              style={{ animationDelay: `${i * 150}ms`, width: `${100 - i * 12}%` }}
            />
          ))}
        </div>
        <ThemedText type="caption">Sorting that into tasks</ThemedText>
      </div>
    );
  }

  if (stage === "preview") {
    return (
      <div className="flex flex-col gap-6 py-2">
        <div className="flex flex-col gap-1">
          <ThemedText type="fancyFrauncesSubheading">
            {count > 0 ? `${count} task${count === 1 ? "" : "s"} ready` : "Nothing to add"}
          </ThemedText>
          <ThemedText type="caption">Click a title to edit it. Remove anything you don't want.</ThemedText>
        </div>
        <div className="flex max-h-[45vh] flex-col gap-5 overflow-y-auto pr-1">
          {payload.categories.map((cat, ci) => (
            <section key={`cat-${ci}`} className="flex flex-col gap-2">
              <ThemedText type="caption">
                <span className="text-foreground">{cat.name}</span> · New in {cat.workspaceName}
              </ThemedText>
              {cat.tasks.map((t, ti) => (
                <PreviewTaskRow
                  key={`cat-${ci}-${ti}`}
                  keyId={`cat-${ci}-${ti}`}
                  task={t}
                  onEditTitle={(content) => editTitle({ kind: "cat", ci, ti }, content)}
                  onRemove={() => removeAt({ kind: "cat", ci, ti })}
                />
              ))}
            </section>
          ))}
          {payload.tasks.length > 0 && (
            <section className="flex flex-col gap-2">
              {payload.tasks.map((pair, pi) => (
                <div key={`pair-${pi}`} className="flex flex-col gap-2">
                  {pair.categoryName && pair.categoryName !== payload.tasks[pi - 1]?.categoryName && (
                    <ThemedText type="caption" className="mt-1 text-foreground">{pair.categoryName}</ThemedText>
                  )}
                  <PreviewTaskRow
                    keyId={`pair-${pi}`}
                    task={pair.task}
                    onEditTitle={(content) => editTitle({ kind: "pair", pi }, content)}
                    onRemove={() => removeAt({ kind: "pair", pi })}
                  />
                </div>
              ))}
            </section>
          )}
        </div>
        {error && <ThemedText type="caption" className="text-destructive">{error}</ThemedText>}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => { setError(null); setStage("prompt"); }}
            className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-muted-foreground transition-colors duration-150 hover:bg-white/10 hover:text-foreground"
          >
            <ArrowLeft size={14} />
            <ThemedText type="caption" className="text-inherit">Edit what I wrote</ThemedText>
          </button>
          <GlowButton
            label={confirm.isPending ? "Adding" : count > 0 ? `Add ${count} task${count === 1 ? "" : "s"}` : "Nothing to add"}
            onClick={create}
            disabled={count === 0 || confirm.isPending}
          />
        </div>
      </div>
    );
  }

  // stage === "prompt"
  const empty = !text.trim() && !image;
  return (
    <div className="flex flex-col gap-5 py-2">
      {image ? (
        <div className="relative w-fit animate-in fade-in duration-200">
          <img src={image} alt="Attached" className="max-h-48 rounded-2xl object-contain" />
          <button
            type="button"
            aria-label="Remove image"
            onClick={() => setImage(null)}
            className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-white text-black shadow"
          >
            <X size={12} weight="bold" />
          </button>
        </div>
      ) : (
        <textarea
          autoFocus
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onPromptKey}
          onPaste={onPromptPaste}
          placeholder="What's on your plate?"
          className="min-h-24 w-full resize-none bg-transparent font-heading text-2xl font-semibold leading-snug tracking-[-1px] text-foreground outline-none placeholder:text-foreground/30"
        />
      )}

      {empty && (
        <div className="flex flex-col gap-1 animate-in fade-in duration-300">
          <ThemedText type="caption" className="mb-1">Try something like</ThemedText>
          {PLACEHOLDERS.slice(0, 3).map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setText(example)}
              className="group -mx-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-muted-foreground transition-colors duration-150 hover:bg-white/[0.06] hover:text-foreground"
            >
              <ArrowUpRight size={14} className="shrink-0 transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              <ThemedText type="caption" className="truncate text-inherit">{example}</ThemedText>
            </button>
          ))}
        </div>
      )}

      {error && <ThemedText type="caption" className="text-destructive">{error}</ThemedText>}
      <div className="flex items-center gap-2">
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
        <button
          type="button"
          aria-label="Attach image from files"
          onClick={() => fileInputRef.current?.click()}
          className="grid size-10 place-items-center rounded-full bg-white/10 text-foreground transition-colors duration-150 hover:bg-white/[0.16]"
        >
          <ImageIcon size={18} />
        </button>
        <button
          type="button"
          aria-label="Paste image from clipboard"
          onClick={pasteFromClipboard}
          className="grid size-10 place-items-center rounded-full bg-white/10 text-foreground transition-colors duration-150 hover:bg-white/[0.16]"
        >
          <Clipboard size={18} />
        </button>
        <ThemedText type="caption" className="ml-2 hidden sm:block">
          Enter to sort · Shift+Enter for a new line
        </ThemedText>
        <div className="ml-auto">
          <GlowButton label="Sort into tasks" onClick={generate} disabled={!canGenerate} />
        </div>
      </div>
    </div>
  );
}

// The stage's single main action: primary pill with the hero glow.
function GlowButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-primary-foreground shadow-[0_6px_10px_-2px_rgba(133,77,255,0.35)] transition-[transform,opacity,box-shadow] duration-150 hover:opacity-95 active:scale-[0.97] disabled:bg-white/10 disabled:text-foreground/40 disabled:shadow-none"
    >
      <ThemedText type="defaultSemiBold" className="text-sm text-inherit">{label}</ThemedText>
    </button>
  );
}

// ---- pure payload edits (coordinate-addressed) ----
function mutateAt(
  p: AiPreviewPayload,
  c: Coord,
  fn: (t: CreateTaskParams) => CreateTaskParams,
): AiPreviewPayload {
  if (c.kind === "cat") {
    const categories = p.categories.map((cat, i) =>
      i === c.ci ? { ...cat, tasks: cat.tasks.map((t, j) => (j === c.ti ? fn(t) : t)) } : cat,
    );
    return { ...p, categories };
  }
  return { ...p, tasks: p.tasks.map((pair, i) => (i === c.pi ? { ...pair, task: fn(pair.task) } : pair)) };
}

function removeCoord(p: AiPreviewPayload, c: Coord): AiPreviewPayload {
  if (c.kind === "cat") {
    const categories = p.categories.map((cat, i) =>
      i === c.ci ? { ...cat, tasks: cat.tasks.filter((_, j) => j !== c.ti) } : cat,
    );
    return { ...p, categories };
  }
  return { ...p, tasks: p.tasks.filter((_, i) => i !== c.pi) };
}
