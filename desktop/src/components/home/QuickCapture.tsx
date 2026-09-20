import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import { ArrowRight, Check, MagicWand } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
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

const PRIORITY_LABEL: Record<number, string> = { 1: "Low priority", 2: "Medium priority", 3: "High priority" };

// How long the "created" line sticks around. Long enough to read and catch a
// wrong date, short enough that it doesn't become furniture.
const RECEIPT_MS = 8000;

type Receipt = {
  content: string;
  /** Human-readable schedule, e.g. "Fri · 5:00 PM · every week". */
  schedule: string;
  priority?: number;
};

/**
 * One-line capture above the rings: type a task, press Enter, done. Everything
 * else is inferred — the schedule is parsed from the text as you type, priority
 * and difficulty come from the suggest endpoint, and the category is left to
 * the background categorizer. The receipt line below says what was inferred so
 * a wrong guess is visible immediately rather than discovered later.
 */
export function QuickCapture() {
  const [text, setText] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const createTaskAuto = useCreateTaskAuto();
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
        onSuccess: () =>
          setReceipt({
            content,
            schedule: describeSchedule(schedule, recurrence),
            priority: fuzzy?.priority,
          }),
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

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 rounded-xl bg-secondary/60 px-4 py-3 transition-colors focus-within:bg-secondary">
        <MagicWand size={18} weight="regular" className="shrink-0 text-muted-foreground" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Add a task — we'll sort out the details"
          aria-label="Quick add a task"
          className="min-w-0 flex-1 bg-transparent text-base font-light text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim() || createTaskAuto.isPending}
          aria-label="Create task"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
        >
          <ArrowRight size={16} weight="bold" />
        </button>
      </div>

      {receipt ? <ReceiptLine receipt={receipt} /> : null}
    </div>
  );
}

function ReceiptLine({ receipt }: { receipt: Receipt }) {
  // "Sorting…" is always shown: the category is decided by a background job, so
  // it's the one detail that is still pending when the receipt appears.
  const details = [receipt.schedule, receipt.priority ? PRIORITY_LABEL[receipt.priority] : "", "sorting into a category"]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex items-center gap-2 px-4" role="status">
      <Check size={14} weight="bold" className="shrink-0 text-primary" />
      <ThemedText type="caption" className="truncate">
        Added “{receipt.content}” — {details}
      </ThemedText>
    </div>
  );
}
