import { useState } from "react";
import { CalendarCheck, CircleNotch, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ThemedText } from "@/components/ThemedText";
import { previewEnrich, useApplyEnrich, type EnrichChange, type EnrichPreview, type EnrichStatus } from "@/hooks/useEnrich";

type Stage = "intro" | "loading" | "review" | "error";

// Dropping a summary entry drops the update fields behind it, so what's applied matches what's shown.
const FIELD_KEYS: Record<string, (keyof EnrichChange["updates"])[]> = {
  content: ["content"],
  start: ["startDate", "startTime"],
  deadline: ["deadline"],
  priority: ["priority"],
  value: ["value"],
};

function dropPart(change: EnrichChange, index: number): EnrichChange | null {
  const updates = { ...change.updates };
  (FIELD_KEYS[change.fields?.[index] ?? ""] ?? []).forEach((key) => delete updates[key]);
  const summary = change.summary.filter((_, i) => i !== index);
  if (summary.length === 0) return null;
  return { ...change, updates, summary, fields: change.fields?.filter((_, i) => i !== index) };
}

export function EnrichDialog({
  open,
  onOpenChange,
  status,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: EnrichStatus;
  onApplied: () => void;
}) {
  const apply = useApplyEnrich();
  const [stage, setStage] = useState<Stage>("intro");
  const [preview, setPreview] = useState<EnrichPreview | null>(null);
  const [changes, setChanges] = useState<EnrichChange[]>([]);
  const [applying, setApplying] = useState(false);

  const lookOver = async () => {
    setStage("loading");
    try {
      const next = await previewEnrich();
      setPreview(next);
      setChanges(next.changes);
      setStage("review");
    } catch {
      setStage("error");
    }
  };

  const submit = async () => {
    if (!changes.length) return;
    setApplying(true);
    try {
      const tasks = await apply(changes);
      toast.success(`Updated ${tasks.length} task${tasks.length === 1 ? "" : "s"}`);
      onApplied();
      onOpenChange(false);
    } catch {
      toast.error("Couldn't apply those changes. Something went wrong on our end. Give it another try.");
    } finally {
      setApplying(false);
    }
  };

  const n = status.candidateCount;
  const stale = status.staleCount;
  const points = [
    `Look over the ${n} open task${n === 1 ? "" : "s"} with no day planned${stale > 0 ? `, including ${stale} that slipped past their day` : ""}.`,
    "Suggest a day for each over the next two weeks, spread around what you already have planned.",
    "Add a due date or time only where the title implies one, and set priority only where it is obvious.",
    "Fix small title issues like casing and typos, keeping your words.",
  ];
  const removed = preview ? preview.changes.length - changes.length : 0;
  const edited = changes.filter((c) => preview?.changes.find((p) => p.taskId === c.taskId)?.summary.length !== c.summary.length).length;
  const count = changes.length;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setStage("intro");
      }}
    >
      <DialogContent className="max-w-lg gap-6">
        <DialogTitle>
          <ThemedText type="fancyFrauncesSubheading" as="span">
            Tidy up your tasks
          </ThemedText>
        </DialogTitle>

        <div key={stage} className="flex max-h-[55vh] flex-col gap-4 overflow-y-auto animate-in fade-in duration-200">
          {stage === "intro" && (
            <>
              <ThemedText type="larger_default">Here's what Kindred will do</ThemedText>
              <div className="flex flex-col gap-3">
                {points.map((p) => (
                  <div key={p} className="flex items-start gap-3">
                    <CalendarCheck size={18} className="mt-0.5 shrink-0 text-primary" />
                    <ThemedText type="caption">{p}</ThemedText>
                  </div>
                ))}
              </div>
              <ThemedText type="caption">
                Nothing changes yet. You'll see every suggestion and can drop any of them before applying.
              </ThemedText>
            </>
          )}

          {stage === "loading" && (
            <div className="flex flex-col items-center gap-3 py-12">
              <CircleNotch size={20} className="animate-spin text-primary" />
              <ThemedText type="caption">Looking over your tasks</ThemedText>
            </div>
          )}

          {stage === "error" && (
            <div className="py-12 text-center">
              <ThemedText type="caption">Couldn't look over your tasks right now.</ThemedText>
            </div>
          )}

          {stage === "review" && preview && (
            <>
              <ThemedText type="caption">
                {preview.overview}
                {preview.changes.length > 0 ? " Remove anything you don't want." : ""}
              </ThemedText>
              <div className="flex flex-col">
                {changes.map((change) => (
                  <div key={change.taskId} className="group flex flex-col gap-2 border-b border-border/60 py-3 last:border-b-0 animate-in fade-in duration-150">
                    <div className="flex items-start gap-3">
                      <div className="flex min-w-0 flex-1 flex-col">
                        <ThemedText type="default" className="line-clamp-2">
                          {change.taskName}
                        </ThemedText>
                        {change.categoryName && <ThemedText type="caption">{change.categoryName}</ThemedText>}
                      </div>
                      <button
                        type="button"
                        aria-label={`Don't change ${change.taskName}`}
                        onClick={() => setChanges((prev) => prev.filter((c) => c.taskId !== change.taskId))}
                        className="grid size-7 place-items-center rounded-full text-muted-foreground opacity-60 transition-[opacity,background-color] duration-150 hover:bg-muted hover:text-foreground group-hover:opacity-100"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {change.summary.map((label, index) => (
                        <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-primary/[0.08] py-1 pl-3 pr-2 text-primary">
                          <ThemedText type="caption" className="text-primary">
                            {label}
                          </ThemedText>
                          {change.summary.length > 1 && (
                            <button
                              type="button"
                              aria-label={`Drop ${label}`}
                              onClick={() =>
                                setChanges((prev) =>
                                  prev.flatMap((c) => {
                                    if (c.taskId !== change.taskId) return [c];
                                    const next = dropPart(c, index);
                                    return next ? [next] : [];
                                  })
                                )
                              }
                              className="grid size-4 place-items-center rounded-full text-primary/60 transition-colors hover:text-primary"
                            >
                              <X size={10} weight="bold" />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                    {change.reason && <ThemedText type="caption">{change.reason}</ThemedText>}
                  </div>
                ))}
              </div>
              {(removed > 0 || edited > 0) && (
                <button type="button" onClick={() => setChanges(preview.changes)} className="w-fit text-primary hover:underline">
                  <ThemedText type="caption" className="text-primary">
                    Bring back everything I removed
                  </ThemedText>
                </button>
              )}
            </>
          )}
        </div>

        {(stage === "intro" || stage === "error" || (stage === "review" && (preview?.changes.length ?? 0) > 0)) && (
          <button
            type="button"
            disabled={applying || (stage === "review" && count === 0)}
            onClick={stage === "review" ? submit : lookOver}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_6px_10px_-2px_rgba(133,77,255,0.3)] transition-[transform,opacity] duration-150 hover:opacity-95 active:scale-[0.99] disabled:opacity-50"
          >
            <ThemedText type="defaultSemiBold" className="text-primary-foreground">
              {stage === "intro"
                ? "Look over my tasks"
                : stage === "error"
                  ? "Try again"
                  : applying
                    ? "Applying"
                    : count === 0
                      ? "Nothing to apply"
                      : `Apply to ${count} task${count === 1 ? "" : "s"}`}
            </ThemedText>
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
