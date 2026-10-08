import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, CalendarBlank, Check, Clock, Flag, Info, Plus, X } from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import { useRingUpdate } from "@/components/rings/RingUpdateContext";
import { useTaskSuggestions } from "@/hooks/useTaskSuggestions";
import { usePeakTimeDefault } from "@/hooks/usePeakTimeDefault";
import {
  applySchedule,
  buildCreateTaskParams,
  emptyTaskForm,
  noAppliedSuggestion,
  useCreateTaskAuto,
  CREATE_AUTH,
} from "@/hooks/useCreateActions";
import { describeSchedule, scheduleSpans } from "@shared/taskSuggest";
import { describeEnrichment } from "@shared/quickCapture";

// How long the "created" line sticks around. Long enough to read and catch a
// wrong date, short enough that it doesn't become furniture.
const RECEIPT_MS = 8000;

// Same quick dates as mobile's capture chips; offered until the text already has a date.
const QUICK_WHEN = ["today", "tonight", "tomorrow", "this weekend", "next week", "every day"];
const PRIORITY_LABEL: Record<number, string> = { 1: "Low priority", 2: "Medium priority", 3: "High priority" };

// Splits text into plain and recognized runs for the highlight mirror.
function segment(text: string, spans: { start: number; end: number }[]) {
  const out: { text: string; hit: boolean }[] = [];
  let at = 0;
  for (const { start, end } of spans) {
    if (start < at) continue;
    if (start > at) out.push({ text: text.slice(at, start), hit: false });
    out.push({ text: text.slice(start, end), hit: true });
    at = end;
  }
  if (at < text.length) out.push({ text: text.slice(at), hit: false });
  return out;
}

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
  const { schedule, recurrence, fuzzy, dismiss } = useTaskSuggestions(text);
  const inputRef = useRef<HTMLInputElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const parsed = Boolean(schedule || recurrence);
  const peak = usePeakTimeDefault();
  const [peakDismissed, setPeakDismissed] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [optOutNotice, setOptOutNotice] = useState(false);
  const segments = useMemo(
    () => (parsed ? segment(text, scheduleSpans(text, new Date())) : [{ text, hit: false }]),
    [text, parsed]
  );
  // Keep the mirror aligned once the input scrolls horizontally on long text.
  const syncScroll = () => {
    if (mirrorRef.current && inputRef.current) mirrorRef.current.scrollLeft = inputRef.current.scrollLeft;
  };
  useEffect(syncScroll, [text]);
  const appendWhen = (phrase: string) => {
    setText((prev) => (prev.trim() ? `${prev.trimEnd()} ${phrase}` : prev));
    inputRef.current?.focus();
  };

  // A dismissal covers the task being typed; the next task gets the default again.
  useEffect(() => {
    if (text.trim() === "") {
      setPeakDismissed(false);
      setShowWhy(false);
    }
  }, [text]);

  useEffect(() => {
    if (!receipt) return;
    const timer = setTimeout(() => setReceipt(null), RECEIPT_MS);
    return () => clearTimeout(timer);
  }, [receipt]);

  // Peak-hour default only fills an empty schedule, and is one tap to drop.
  const peakDefault = text.trim() && !parsed && !peakDismissed ? peak.suggestion : null;

  const submit = () => {
    const content = text.trim();
    if (!content || createTaskAuto.isPending) return;

    const usePeak = peakDefault !== null;
    const effectiveSchedule = usePeak ? peakDefault.schedule : schedule;
    const { form } = applySchedule(
      { ...emptyTaskForm(), content },
      effectiveSchedule,
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
          setReceipt({ content, details: describeEnrichment(describeSchedule(effectiveSchedule, recurrence), fuzzy?.priority) });
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
      <div className="flex min-h-12 items-center gap-3 rounded-full bg-background py-2 pl-5 pr-2 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_8px_28px_-14px_rgba(0,0,0,0.12)] transition-shadow duration-200 focus-within:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.18)] dark:bg-card">
        <Plus size={18} weight="bold" className="shrink-0 text-primary" />
        <div className="relative min-w-0 flex-1">
          {/* Mirror draws the text so recognized dates can be colored; the input above is transparent but owns the caret. */}
          <div
            ref={mirrorRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre font-sans text-base font-light leading-[inherit] text-foreground"
          >
            {segments.map((seg, i) =>
              seg.hit ? (
                <span key={`${i}-${seg.text}`} className="rounded-md bg-primary/10 text-primary shadow-[0_0_0_2px_color-mix(in_oklab,var(--color-primary)_10%,transparent)] animate-in fade-in duration-200">
                  {seg.text}
                </span>
              ) : (
                <span key={i}>{seg.text}</span>
              )
            )}
          </div>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            onScroll={syncScroll}
            onSelect={syncScroll}
            placeholder="Add a task, like gym @7am tomorrow"
            aria-label="Quick add a task"
            className="relative w-full bg-transparent font-sans text-base font-light text-transparent caret-foreground outline-none placeholder:text-muted-foreground selection:bg-primary/20 selection:text-foreground"
          />
        </div>
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

      {text.trim() !== "" && (
        <div className="flex flex-wrap items-center gap-2 px-2 animate-in fade-in duration-200">
          {preview !== "" && (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary/10 pl-3 pr-1 text-primary animate-in fade-in zoom-in-95 duration-200">
              <CalendarBlank size={14} weight="bold" />
              <ThemedText type="caption" className="text-primary">
                {preview}
              </ThemedText>
              <button
                type="button"
                aria-label="Ignore this date"
                onClick={() => {
                  dismiss();
                  inputRef.current?.focus();
                }}
                className="grid size-6 place-items-center rounded-full text-primary/60 transition-colors hover:bg-primary/10 hover:text-primary"
              >
                <X size={11} weight="bold" />
              </button>
            </span>
          )}
          {peakDefault && (
            <span className="inline-flex h-8 items-center gap-1 rounded-full bg-primary/10 pl-3 pr-1 text-primary animate-in fade-in duration-200">
              <Clock size={14} weight="bold" />
              <ThemedText type="caption" className="ml-0.5 text-primary">
                {peakDefault.label}
              </ThemedText>
              <button
                type="button"
                aria-label="Why this time"
                aria-expanded={showWhy}
                onClick={() => setShowWhy((v) => !v)}
                className="grid size-6 place-items-center rounded-full text-primary/60 transition-colors hover:bg-primary/10 hover:text-primary"
              >
                <Info size={13} weight="bold" />
              </button>
              <button
                type="button"
                aria-label="No time for this task"
                onClick={() => {
                  setPeakDismissed(true);
                  setShowWhy(false);
                  inputRef.current?.focus();
                }}
                className="grid size-6 place-items-center rounded-full text-primary/60 transition-colors hover:bg-primary/10 hover:text-primary"
              >
                <X size={11} weight="bold" />
              </button>
            </span>
          )}
          {fuzzy?.priority !== undefined && PRIORITY_LABEL[fuzzy.priority] && (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-muted/70 px-3 text-muted-foreground animate-in fade-in duration-200">
              <Flag size={14} />
              <ThemedText type="caption" className="text-inherit">
                {PRIORITY_LABEL[fuzzy.priority]}
              </ThemedText>
            </span>
          )}
          {preview === "" &&
            QUICK_WHEN.map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() => appendWhen(phrase)}
                className="inline-flex h-8 items-center rounded-full bg-muted/70 px-3 text-muted-foreground transition-[background-color,color,transform] duration-150 hover:bg-muted hover:text-foreground active:scale-[0.97]"
              >
                <ThemedText type="caption" className="text-inherit">
                  {phrase.charAt(0).toUpperCase() + phrase.slice(1)}
                </ThemedText>
              </button>
            ))}
        </div>
      )}

      {peakDefault && showWhy && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 animate-in fade-in duration-200">
          <ThemedText type="caption">{peakDefault.reason}</ThemedText>
          <button
            type="button"
            onClick={() => {
              peak.setOff(true);
              setShowWhy(false);
              setOptOutNotice(true);
            }}
            className="underline-offset-4 hover:underline"
          >
            <ThemedText type="caption" className="text-foreground">
              Not for me
            </ThemedText>
          </button>
        </div>
      )}
      {optOutNotice && peak.optedOut && (
        <div className="flex items-center gap-3 px-4" role="status">
          <ThemedText type="caption">No more suggested times.</ThemedText>
          <button
            type="button"
            onClick={() => {
              peak.setOff(false);
              setOptOutNotice(false);
            }}
            className="underline-offset-4 hover:underline"
          >
            <ThemedText type="caption" className="text-foreground">
              Undo
            </ThemedText>
          </button>
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
