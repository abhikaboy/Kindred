import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CaretRight, CheckCircle, Circle, MoonStars, PlusCircle, XCircle } from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import PrimaryButton from "@/components/PrimaryButton";
import { ThemedText } from "@/components/ThemedText";
import { useAllTasks } from "@/hooks/useHomeTasks";
import { useWorkspaces, type TaskDocument } from "@/hooks/useWorkspaces";
import { AUTH_HEADER } from "@/hooks/useTaskActions";
import { $api } from "@/lib/api/query";
import { quickLogDoneKey, runEndOfDaySubmission, todaysOpenTasks } from "@shared/endOfDay";

// Hidden once today's log succeeded; re-checks every minute so it returns after midnight.
function useQuickLogDone() {
  const read = () => localStorage.getItem(quickLogDoneKey(new Date())) != null;
  const [done, setDone] = useState(read);

  useEffect(() => {
    const interval = setInterval(() => setDone(read()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const markDone = useCallback(() => {
    localStorage.setItem(quickLogDoneKey(new Date()), "1");
    setDone(true);
  }, []);

  return { done, markDone };
}

/** Home entry point for the end-of-day review: check off today's tasks and log untracked ones. */
export function QuickLogDay() {
  const allTasks = useAllTasks();
  const [open, setOpen] = useState(false);
  const { done, markDone } = useQuickLogDone();
  const openTasks = useMemo(() => todaysOpenTasks(allTasks), [allTasks]);

  const subtitle =
    openTasks.length > 0
      ? `${openTasks.length} open task${openTasks.length === 1 ? "" : "s"} from today to check off`
      : "Add anything you got done today";

  return (
    <>
      {!done && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Quick log my day"
          className="flex w-full items-center gap-3 rounded-xl bg-primary p-3 text-left text-primary-foreground transition-opacity hover:opacity-90"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/15">
            <MoonStars size={20} weight="fill" className="text-white" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <ThemedText type="defaultSemiBold" className="text-primary-foreground">
              Quick log my day
            </ThemedText>
            <ThemedText type="caption" className="text-primary-foreground opacity-80">
              {subtitle}
            </ThemedText>
          </span>
          <CaretRight size={16} weight="bold" className="shrink-0 text-white" />
        </button>
      )}
      {/* Stays mounted after markDone so the dialog can finish closing */}
      <EndOfDayReviewDialog open={open} onOpenChange={setOpen} openTasks={openTasks} onLogged={markDone} />
    </>
  );
}

function EndOfDayReviewDialog({
  open,
  onOpenChange,
  openTasks,
  onLogged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  openTasks: TaskDocument[];
  onLogged: () => void;
}) {
  const qc = useQueryClient();
  const { data: workspaces } = useWorkspaces();
  const bulkComplete = $api.useMutation("post", "/v1/user/tasks/bulk/complete");
  const logTasks = $api.useMutation("post", "/v1/user/tasks/log");

  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [entries, setEntries] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Mobile prefers the open workspace; the home page has none, so use the busiest one.
  const workspace = workspaces?.[0];
  const categoryNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const ws of workspaces ?? []) for (const c of ws.categories) names.set(c.id, c.name);
    return names;
  }, [workspaces]);

  const toggleTask = (id: string) =>
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const addEntry = () => {
    const content = draft.trim();
    if (!content) return;
    setEntries((prev) => [...prev, content]);
    setDraft("");
  };

  const canSubmit = !submitting && (checkedIds.size > 0 || entries.length > 0 || draft.trim().length > 0);

  const submit = async () => {
    // Pull in an un-added draft so "type and hit Log" works without clicking +.
    const pendingEntries = draft.trim() ? [...entries, draft.trim()] : entries;
    const checkedTasks = openTasks.filter((t) => checkedIds.has(t.id));
    if (checkedTasks.length === 0 && pendingEntries.length === 0) return;

    setSubmitting(true);
    try {
      const timeCompleted = new Date().toISOString();
      const result = await runEndOfDaySubmission(checkedTasks, pendingEntries, workspace?.name, {
        bulkComplete: (items) =>
          bulkComplete.mutateAsync({
            params: { header: AUTH_HEADER },
            body: {
              tasks: items.map((i) => ({ ...i, completeData: { timeCompleted, timeTaken: "PT0S" } })),
            },
          } as never),
        logTasks: (workspaceName, contents) =>
          logTasks.mutateAsync({
            params: { header: AUTH_HEADER },
            body: { workspaceName, tasks: contents.map((content) => ({ content })) },
          } as never),
      });

      setDraft("");
      setEntries(result.remainingEntries);
      setCheckedIds(new Set());
      qc.invalidateQueries({ queryKey: ["get", "/v1/user/workspaces"] });
      qc.invalidateQueries({ queryKey: ["get", "/v1/tasks/"] });
      qc.invalidateQueries({ queryKey: ["get", "/v1/user/rings/today"] });

      const total = result.completedCount + result.loggedCount;
      if (result.failedCount > 0) {
        toast.warning(`${total} logged, ${result.failedCount} failed — try those again`);
      } else {
        toast.success(`Nice — ${total} task${total === 1 ? "" : "s"} logged for today`);
        onLogged();
        onOpenChange(false);
      }
    } catch (error) {
      console.error("End of day review failed:", error);
      toast.error("Couldn't log your day. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-6">
        <DialogTitle>
          <ThemedText type="fancyFrauncesSubheading" as="span">
            How did today go?
          </ThemedText>
        </DialogTitle>

        <div className="flex max-h-[50vh] flex-col gap-6 overflow-y-auto">
          {openTasks.length > 0 && (
            <section className="flex flex-col gap-2">
              <ThemedText type="defaultSemiBold">Did you finish these?</ThemedText>
              {openTasks.map((t) => {
                const checked = checkedIds.has(t.id);
                const categoryName = t.categoryID ? categoryNames.get(t.categoryID) : undefined;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTask(t.id)}
                    aria-pressed={checked}
                    className="flex items-center gap-3 rounded-lg py-2 text-left"
                  >
                    {checked ? (
                      <CheckCircle size={24} weight="fill" className="shrink-0 text-primary" />
                    ) : (
                      <Circle size={24} className="shrink-0 text-muted-foreground" />
                    )}
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <ThemedText type="default" className="truncate">
                        {t.content}
                      </ThemedText>
                      {categoryName ? <ThemedText type="caption">{categoryName}</ThemedText> : null}
                    </span>
                  </button>
                );
              })}
            </section>
          )}

          <section className="flex flex-col gap-2">
            <ThemedText type="defaultSemiBold">Anything else you got done?</ThemedText>
            {entries.map((content, index) => (
              <div key={`${content}-${index}`} className="flex items-center gap-3 py-2">
                <CheckCircle size={24} weight="fill" className="shrink-0 text-emerald-500" />
                <ThemedText type="default" className="min-w-0 flex-1 truncate">
                  {content}
                </ThemedText>
                <button
                  type="button"
                  onClick={() => setEntries((prev) => prev.filter((_, i) => i !== index))}
                  aria-label={`Remove ${content}`}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <XCircle size={22} />
                </button>
              </div>
            ))}
          </section>
        </div>

        <div className="flex flex-col gap-3 border-t pt-4">
          <div className="flex items-center gap-3">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addEntry();
                }
              }}
              placeholder="e.g. went to the gym"
              aria-label="Something else you got done"
              className="min-w-0 flex-1 rounded-xl border bg-transparent px-3 py-2.5 font-sans text-base font-light outline-none placeholder:text-muted-foreground focus:border-primary"
            />
            <button type="button" onClick={addEntry} aria-label="Add entry" className="text-primary">
              <PlusCircle size={28} />
            </button>
          </div>
          <PrimaryButton title={submitting ? "Logging…" : "Log my day"} onClick={submit} disabled={!canSubmit} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
