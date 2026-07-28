import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import { Sparkle, X, PencilSimple, ArrowLeft } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemedText } from "@/components/ThemedText";
import PrimaryButton from "@/components/PrimaryButton";
import { TaskItem } from "@/components/TaskItem";
import {
  usePreviewTasksAI,
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

// Rotating example prompts shown in the empty prompt box (no em dashes in copy).
const PLACEHOLDERS = [
  "gym at 7am tomorrow, finish the quarterly report by friday, call the dentist",
  "plan mom's birthday dinner, book flights for the trip, renew car insurance",
  "email the client back, review the open PR, prep slides for monday standup",
  "buy groceries, water the plants, schedule a haircut this weekend",
];

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
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        {editing ? (
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commit(); }
              if (e.key === "Escape") { setDraft(task.content); setEditing(false); }
            }}
          />
        ) : (
          <TaskItem preview task={toDisplayTask(task, keyId)} />
        )}
      </div>
      <div className="mt-1 flex shrink-0 items-center gap-1">
        {!editing && (
          <Button variant="ghost" size="icon" aria-label="Edit title" onClick={() => { setDraft(task.content); setEditing(true); }}>
            <PencilSimple size={16} />
          </Button>
        )}
        <Button variant="ghost" size="icon" aria-label="Remove task" onClick={onRemove}>
          <X size={16} />
        </Button>
      </div>
    </div>
  );
}

export function AiTaskPanel({ onClose }: { onClose: () => void }) {
  const [stage, setStage] = useState<Stage>("prompt");
  const [text, setText] = useState("");
  const [payload, setPayload] = useState<AiPreviewPayload>({ categories: [], tasks: [] });
  const [error, setError] = useState<string | null>(null);
  const [phIndex, setPhIndex] = useState(0);

  // Cycle the example placeholder while on the prompt stage.
  useEffect(() => {
    if (stage !== "prompt") return;
    const id = setInterval(() => setPhIndex((i) => (i + 1) % PLACEHOLDERS.length), 3500);
    return () => clearInterval(id);
  }, [stage]);

  const preview = usePreviewTasksAI();
  const confirm = useConfirmTasksAI();

  const canGenerate = text.trim().length >= 4;
  const count = countPreviewTasks(payload);

  const generate = () => {
    if (!canGenerate) return;
    setError(null);
    setStage("loading");
    preview.mutate(
      { params: { header: CREATE_AUTH }, body: { text: text.trim(), timezone: TIMEZONE } },
      {
        onSuccess: (data) => {
          setPayload({ categories: data.categories ?? [], tasks: data.tasks ?? [] });
          setStage("preview");
        },
        onError: (e: unknown) => {
          setError(getErrorMessage(e));
          setStage("prompt");
        },
      },
    );
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
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <Sparkle size={32} weight="fill" className="animate-pulse text-primary" />
        <ThemedText type="default" className="text-muted-foreground">Generating tasks…</ThemedText>
      </div>
    );
  }

  if (stage === "preview") {
    return (
      <div className="flex flex-col gap-4 py-2">
        {payload.categories.map((cat, ci) => (
          <div key={`cat-${ci}`} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <ThemedText type="defaultSemiBold">{cat.name}</ThemedText>
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5">
                <ThemedText type="caption" className="text-primary">NEW</ThemedText>
              </span>
              <ThemedText type="caption" className="text-muted-foreground">{cat.workspaceName}</ThemedText>
            </div>
            {cat.tasks.map((t, ti) => (
              <PreviewTaskRow
                key={`cat-${ci}-${ti}`}
                keyId={`cat-${ci}-${ti}`}
                task={t}
                onEditTitle={(content) => editTitle({ kind: "cat", ci, ti }, content)}
                onRemove={() => removeAt({ kind: "cat", ci, ti })}
              />
            ))}
          </div>
        ))}
        {payload.tasks.length > 0 && (
          <div className="flex flex-col gap-2">
            {payload.tasks.map((pair, pi) => (
              <div key={`pair-${pi}`} className="flex flex-col gap-2">
                {pair.categoryName && (
                  <ThemedText type="defaultSemiBold">{pair.categoryName}</ThemedText>
                )}
                <PreviewTaskRow
                  keyId={`pair-${pi}`}
                  task={pair.task}
                  onEditTitle={(content) => editTitle({ kind: "pair", pi }, content)}
                  onRemove={() => removeAt({ kind: "pair", pi })}
                />
              </div>
            ))}
          </div>
        )}
        {count === 0 && (
          <ThemedText type="caption" className="text-muted-foreground">
            Nothing to create. Go back and refine your prompt.
          </ThemedText>
        )}
        {error && <ThemedText type="caption" className="text-destructive">{error}</ThemedText>}
        <div className="mt-2 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => { setError(null); setStage("prompt"); }} className="gap-1.5">
            <ArrowLeft size={14} />
            Edit prompt
          </Button>
          <PrimaryButton
            title={count > 0 ? `Create ${count} tasks` : "Nothing to create"}
            onClick={create}
            disabled={count === 0 || confirm.isPending}
            className="w-auto px-5 py-2"
          />
        </div>
      </div>
    );
  }

  // stage === "prompt"
  return (
    <div className="flex flex-col gap-3 py-2">
      <textarea
        autoFocus
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onPromptKey}
        placeholder={PLACEHOLDERS[phIndex]}
        className="min-h-28 w-full resize-none rounded-2xl border border-border bg-transparent p-3 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
      />
      {error && <ThemedText type="caption" className="text-destructive">{error}</ThemedText>}
      <div className="flex items-center justify-end">
        <PrimaryButton
          title="Generate"
          onClick={generate}
          disabled={!canGenerate}
          className="w-auto px-5 py-2"
        />
      </div>
    </div>
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
