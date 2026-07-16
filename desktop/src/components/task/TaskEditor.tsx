import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CalendarBlank,
  Check,
  Flag,
  Note,
  PencilSimple,
  Play,
  Repeat,
  Sparkle,
  Trash,
} from "@phosphor-icons/react";
import { ThemedText } from "@/components/ThemedText";
import ThemedInput from "@/components/ThemedInput";
import PrimaryButton from "@/components/PrimaryButton";
import { DataCard } from "@/components/task/DataCard";
import { KudosBubble } from "@/components/kudos/KudosBubble";
import { ScheduleTimeline } from "@/components/task/ScheduleTimeline";
import type { PickedDateTime } from "@/components/task/DateTimePicker";
import { cn } from "@/lib/utils";
import { fireConfetti } from "@/lib/confetti";
import type { TaskDocument } from "@/hooks/useWorkspaces";
import {
  AUTH_HEADER,
  taskToUpdateDocument,
  useActivateTask,
  useCompleteTask,
  useDeleteTask,
  useUpdateTask,
} from "@/hooks/useTaskActions";

const PRIORITIES: { value: number; label: string; active: string }[] = [
  { value: 1, label: "Low", active: "bg-emerald-500 text-white border-emerald-500" },
  { value: 2, label: "Medium", active: "bg-amber-500 text-white border-amber-500" },
  { value: 3, label: "High", active: "bg-destructive text-white border-destructive" },
];

function PrioritySelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-2">
      {PRIORITIES.map((p) => {
        const isActive = value === p.value;
        return (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange(p.value)}
            className={cn(
              "flex-1 rounded-full border px-4 py-2 text-[15px] font-medium transition-colors",
              isActive ? p.active : "border-border text-muted-foreground hover:bg-secondary"
            )}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

// Midnight (local) of the given date, as an ISO string — the "date only" start value.
export const midnightIso = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();

export function BackLink() {
  return (
    <Link to="/" className="flex w-fit items-center gap-1 text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-5" />
    </Link>
  );
}

type EditFields = {
  content: string;
  notes: string;
  priority: number;
  startDate?: string;
  startTime?: string;
  deadline?: string;
};

type TaskEditorProps = {
  task: TaskDocument;
  categoryId: string;
  onDone?: () => void;
  showBackLink?: boolean;
};

export function TaskEditor({ task, categoryId, onDone, showBackLink = true }: TaskEditorProps) {
  const navigate = useNavigate();
  const headerRef = useRef<HTMLDivElement>(null);
  const completeBtnRef = useRef<HTMLSpanElement>(null);
  const initialContent = useRef(task.content).current;

  const done = onDone ?? (() => navigate(-1));

  // Pencil is a focus cue — put the caret at the end of the editable title.
  const focusTitle = () => {
    const el = headerRef.current?.querySelector<HTMLElement>('[contenteditable="true"]');
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  const [content, setContent] = useState(task.content);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [priority, setPriority] = useState(task.priority);
  const [startDate, setStartDate] = useState<string | undefined>(task.startDate);
  const [startTime, setStartTime] = useState<string | undefined>(task.startTime);
  const [deadline, setDeadline] = useState<string | undefined>(task.deadline);

  const updateTask = useUpdateTask();
  const completeTask = useCompleteTask();
  const deleteTask = useDeleteTask();
  const activateTask = useActivateTask();

  const path = { category: categoryId, id: task.id };
  const isActive = Boolean(task.active || task.workingOnSince);

  // Autosave: always send the full current local state so edits never clobber each other.
  const save = (patch: Partial<EditFields> = {}) => {
    const f: EditFields = { content, notes, priority, startDate, startTime, deadline, ...patch };
    updateTask.mutate({
      params: { header: AUTH_HEADER, path },
      body: taskToUpdateDocument(task, {
        content: f.content.trim() || task.content,
        notes: f.notes,
        priority: f.priority,
        startDate: f.startDate,
        startTime: f.startTime,
        deadline: f.deadline,
      }),
    });
  };

  const handleTitleBlur = () => {
    const trimmed = content.trim();
    if (trimmed && trimmed !== task.content) save({ content: trimmed });
  };

  const handleNotesBlur = () => {
    if (notes !== (task.notes ?? "")) save({ notes });
  };

  // Start date is required, so it's never cleared; deadline is optional (null clears it).
  const handleStartChange = (r: PickedDateTime | null) => {
    if (!r) return;
    const date = midnightIso(r.date);
    const time = r.hasTime ? r.date.toISOString() : undefined;
    setStartDate(date);
    setStartTime(time);
    save({ startDate: date, startTime: time });
  };

  const handleDeadlineChange = (r: PickedDateTime | null) => {
    const dl = r ? r.date.toISOString() : undefined;
    setDeadline(dl);
    save({ deadline: dl });
  };

  const handleStart = () => {
    activateTask.mutate({
      params: { header: AUTH_HEADER, path, query: isActive ? { active: "false" } : undefined },
    });
  };

  const handleComplete = () => {
    completeTask.mutate(
      {
        params: { header: AUTH_HEADER, path },
        body: { timeCompleted: new Date().toISOString(), timeTaken: "PT0S" },
      },
      {
        onSuccess: () => {
          fireConfetti(completeBtnRef.current);
          done();
        },
      }
    );
  };

  const handleDelete = () => {
    if (!window.confirm("Delete this task? This cannot be undone.")) return;
    deleteTask.mutate(
      { params: { header: AUTH_HEADER, path } },
      { onSuccess: () => done() }
    );
  };

  return (
    <div className={cn("flex flex-col gap-6 pt-6", showBackLink && "mx-auto max-w-2xl")}>
      {showBackLink && <BackLink />}

      <div className="flex flex-col gap-4">
        <div ref={headerRef} className="flex items-start gap-2">
          <ThemedText
            as="h1"
            type="title"
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            onInput={(e) => setContent((e.currentTarget as HTMLElement).textContent ?? "")}
            onBlur={handleTitleBlur}
            className="flex-1 rounded-md outline-none focus:bg-secondary/40"
          >
            {initialContent}
          </ThemedText>
          <button
            type="button"
            onClick={focusTitle}
            aria-label="Edit task"
            className="mt-1.5 shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <PencilSimple size={20} weight="regular" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteTask.isPending}
            aria-label="Delete task"
            className="mt-1.5 shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          >
            <Trash size={20} weight="regular" />
          </button>
        </div>

        {/* In-progress toggle — the tag itself starts/stops working (no separate button). */}
        <button
          type="button"
          onClick={handleStart}
          disabled={activateTask.isPending}
          aria-pressed={isActive}
          className={cn(
            "inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1.5 transition-colors disabled:opacity-50",
            isActive
              ? "bg-primary/10 text-primary hover:bg-primary/15"
              : "bg-muted text-muted-foreground hover:bg-muted/70"
          )}
        >
          <Play size={14} weight={isActive ? "fill" : "regular"} />
          <ThemedText
            type="caption"
            className={isActive ? "text-primary" : "text-muted-foreground"}
          >
            {isActive ? "In Progress" : "Start Working"}
          </ThemedText>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <PrimaryButton
            title={completeTask.isPending ? "Completing…" : "Mark Complete"}
            disabled={completeTask.isPending}
            onClick={handleComplete}
            className="w-auto px-5 py-2.5"
          >
            <span ref={completeBtnRef} className="flex items-center">
              <Check size={16} weight="bold" />
            </span>
          </PrimaryButton>
        </div>
      </div>

      <DataCard title="Notes" icon={<Note size={20} weight="regular" className="text-foreground" />}>
        <ThemedInput
          ghost
          textArea
          value={notes}
          onChange={setNotes}
          onBlur={handleNotesBlur}
          placeholder="Add notes"
        />
      </DataCard>

      <DataCard title="Schedule" icon={<CalendarBlank size={20} weight="regular" className="text-foreground" />}>
        <ScheduleTimeline
          startDate={startDate}
          startTime={startTime}
          deadline={deadline}
          onChangeStart={handleStartChange}
          onChangeDeadline={handleDeadlineChange}
        />
      </DataCard>

      <DataCard title="Priority" icon={<Flag size={20} weight="regular" className="text-foreground" />}>
        <PrioritySelector
          value={priority}
          onChange={(p) => {
            setPriority(p);
            save({ priority: p });
          }}
        />
      </DataCard>

      {task.recurring && (
        <DataCard title="Recurring" icon={<Repeat size={20} weight="regular" className="text-foreground" />}>
          <ThemedText type="lightBody" className="text-muted-foreground">
            This task repeats.
          </ThemedText>
        </DataCard>
      )}

      {(task.encouragements?.length ?? 0) > 0 && (
        <DataCard
          title={`Encouragements · ${task.encouragements!.length}`}
          icon={<Sparkle size={20} weight="regular" className="text-foreground" />}
        >
          <div className="flex flex-col gap-4">
            {task.encouragements!.map((k) => (
              <KudosBubble
                key={k.encouragementId}
                name={k.sender.name || k.sender.handle}
                icon={k.sender.icon}
                message={k.message}
              />
            ))}
          </div>
        </DataCard>
      )}
    </div>
  );
}
