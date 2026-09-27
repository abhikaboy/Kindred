import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, CalendarBlank, Check, Plus } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { useRingUpdate } from "@/components/rings/RingUpdateContext";
import { useTaskSuggestions } from "@/hooks/useTaskSuggestions";
import {
  applySchedule,
  buildCreateTaskParams,
  emptyTaskForm,
  noAppliedSuggestion,
  useCreateTaskAuto,
  CREATE_AUTH,
} from "@/hooks/useCreateActions";
import { describeSchedule } from "@shared/taskSuggest";
import { describeEnrichment } from "@shared/quickCapture";

// How long the "created" line sticks around. Long enough to read and catch a
// wrong date, short enough that it doesn't become furniture.
const RECEIPT_MS = 8000;

type Receipt = {
  content: string;
  /** What was inferred, e.g. "Fri · 5:00 PM · High priority · sorting into a category". */
  details: string;
};

/**
 * One-line capture below the rings: type a task, press Enter, done. Everything
 * else is inferred — the schedule is parsed from the text as you type, priority
 * and difficulty come from the suggest endpoint, and the category is left to
 * the background categorizer. The receipt line below says what was inferred so
 * a wrong guess is visible immediately rather than discovered later.
 */
export function QuickCapture() {
  const [text, setText] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const createTaskAuto = useCreateTaskAuto();
  const qc = useQueryClient();
  const { showRingUpdate } = useRingUpdate();
  const { schedule, recurrence, fuzzy } = useTaskSuggestions(text);

  useEffect(() => {
    if (!receipt) return;
    const timer = setTimeout(() => setReceipt(null), RECEIPT_MS);
    return () => clearTimeout(timer);
  }, [receipt]);

  const submit = () => {
    const content = text.trim();
    if (!content || createTaskAuto.isPending) return;

    const { form } = applySchedule(
      { ...emptyTaskForm(), content },
      schedule,
      recurrence,
      noAppliedSuggestion(),
    );
    const enriched = {
      ...form,
      priority: fuzzy?.priority ?? form.priority,
      value: fuzzy?.value ?? form.value,
    };

    // Clear optimistically: the input should be ready for the next thought
    // straight away, and a failure surfaces on the mutation rather than here.
    setText("");
    createTaskAuto.mutate(
      { params: { header: CREATE_AUTH }, body: buildCreateTaskParams(enriched) },
      {
        onSuccess: (data) => {
          showRingUpdate(data?.ringDelta);
          qc.invalidateQueries({ queryKey: ["get", "/v1/user/rings/today"] });
          setReceipt({ content, details: describeEnrichment(describeSchedule(schedule, recurrence), fuzzy?.priority) });
        },
        // The hook toasts the failure; just give the text back.
        onError: () => setText(content),
      },
    );
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  const canSubmit = text.trim().length > 0 && !createTaskAuto.isPending;
  // Show what the parser picked up while typing, so a wrong date is caught before the task exists.
  const preview = text.trim() ? describeSchedule(schedule, recurrence) : "";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-12 items-center gap-3 rounded-xl border bg-background py-2 pl-4 pr-2 transition-shadow focus-within:shadow-[0_8px_16px_rgba(0,0,0,0.08)] dark:bg-card">
        <Plus size={18} weight="bold" className="shrink-0 text-primary" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Add a task"
          aria-label="Quick add a task"
          className="min-w-0 flex-1 bg-transparent text-base font-light text-foreground outline-none placeholder:text-muted-foreground"
        />
        {(canSubmit || createTaskAuto.isPending) && (
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            aria-label="Create task"
            className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <ArrowUp size={16} weight="bold" />
          </button>
        )}
      </div>

      {preview !== "" && (
        <div className="flex items-center gap-1 self-start rounded-full bg-primary/[0.08] px-3 py-1 text-primary">
          <CalendarBlank size={14} weight="bold" />
          <ThemedText type="caption" className="text-primary">
            {preview}
          </ThemedText>
        </div>
      )}

      {receipt ? <ReceiptLine receipt={receipt} /> : null}
    </div>
  );
}

function ReceiptLine({ receipt }: { receipt: Receipt }) {
  return (
    <div className="flex items-center gap-2 px-4" role="status">
      <Check size={14} weight="bold" className="shrink-0 text-primary" />
      <ThemedText type="caption" className="truncate">
        Added “{receipt.content}” — {receipt.details}
      </ThemedText>
    </div>
  );
}
