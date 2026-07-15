import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { CaretDown, CaretRight, Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ThemedText } from "@/components/ThemedText";
import PrimaryButton from "@/components/PrimaryButton";
import { TaskPropertyRow } from "@/components/create/TaskPropertyRow";
import { RecurrenceFields } from "@/components/create/RecurrenceFields";
import { ReminderFields } from "@/components/create/ReminderFields";
import type { CreateTaskDialogProps, SelectedCategory } from "@/components/create/types";
import {
    useCreateTask,
    buildCreateTaskParams,
    emptyTaskForm,
    CREATE_AUTH,
    type TaskFormState,
} from "@/hooks/useCreateActions";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useFriends } from "@/hooks/useConnections";

// 0 none, 1 low, 2 med, 3 high — 1/2/3 colored green/amber/red.
const PRIORITIES = [
    { value: 0, label: "None", dot: "" },
    { value: 1, label: "Low", dot: "bg-emerald-500" },
    { value: 2, label: "Med", dot: "bg-amber-500" },
    { value: 3, label: "High", dot: "bg-destructive" },
];

const INTEGRATIONS = [
    { value: "", label: "None" },
    { value: "amazon", label: "Amazon" },
    { value: "gmail", label: "Gmail" },
    { value: "outlook", label: "Outlook" },
    { value: "imessage", label: "iMessage" },
    { value: "slack", label: "Slack" },
    { value: "linkedin", label: "LinkedIn" },
    { value: "chrome", label: "Chrome" },
    { value: "safari", label: "Safari" },
];

const selectClass =
    "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time; format the ISO parts.
function isoToLocalInput(iso: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const localToIso = (local: string): string | null => (local ? new Date(local).toISOString() : null);

export function CreateTaskDialog({
    open,
    onOpenChange,
    prefill,
    onRequestNewCategory,
}: CreateTaskDialogProps) {
    const [form, setForm] = useState<TaskFormState>(emptyTaskForm);
    const [selectedCategory, setSelectedCategory] = useState<SelectedCategory | null>(null);
    const [advanced, setAdvanced] = useState(false);
    const titleRef = useRef<HTMLInputElement>(null);

    const { data: workspaces } = useWorkspaces();
    const { data: friends } = useFriends();
    const createTask = useCreateTask();

    const categories = useMemo<SelectedCategory[]>(
        () =>
            (workspaces ?? []).flatMap((ws) =>
                ws.categories.map((c) => ({
                    id: c.id,
                    name: c.name,
                    workspaceName: c.workspaceName,
                })),
            ),
        [workspaces],
    );
    const firstWorkspaceName = workspaces?.[0]?.name;

    // Reset form + preselect category + seed date/time fields from prefill each time the dialog opens.
    useEffect(() => {
        if (!open) return;
        setForm({
            ...emptyTaskForm(),
            deadline: prefill?.deadline ?? null,
            startDate: prefill?.startDate ?? null,
            startTime: prefill?.startTime ?? null,
        });
        setAdvanced(Boolean(prefill?.startTime || prefill?.startDate));
        const initial = prefill?.categoryId
            ? categories.find((c) => c.id === prefill.categoryId) ?? null
            : null;
        setSelectedCategory(initial);
        const raf = requestAnimationFrame(() => titleRef.current?.focus());
        return () => cancelAnimationFrame(raf);
        // Only re-run on open transition; categories may resolve async but initial
        // selection stays valid via the object stored below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const canSubmit = form.content.trim().length > 0 && !!selectedCategory;

    const submit = () => {
        if (!canSubmit || !selectedCategory) return;
        createTask.mutate({
            params: { header: CREATE_AUTH, path: { category: selectedCategory.id } },
            body: buildCreateTaskParams(form),
        });
        onOpenChange(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            submit();
        }
    };

    const onCategoryChange = (id: string) => {
        if (id === "__new__") {
            onRequestNewCategory(selectedCategory?.workspaceName ?? firstWorkspaceName, (cat) =>
                setSelectedCategory(cat),
            );
            return;
        }
        setSelectedCategory(categories.find((c) => c.id === id) ?? null);
    };

    const toggleFriend = (id: string) =>
        setForm((prev) => ({
            ...prev,
            taggedUserIds: prev.taggedUserIds.includes(id)
                ? prev.taggedUserIds.filter((x) => x !== id)
                : [...prev.taggedUserIds, id],
        }));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="gap-0" onKeyDown={onKeyDown}>
                <div className="flex flex-col gap-1">
                    <input
                        ref={titleRef}
                        value={form.content}
                        onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                        placeholder="Task title"
                        className="w-full bg-transparent font-heading text-lg font-medium text-foreground outline-none placeholder:text-muted-foreground"
                    />
                    <input
                        value={form.notes}
                        onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                        placeholder="Add a note…"
                        className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    />
                </div>

                <div className="mt-4 flex flex-col gap-3">
                    <TaskPropertyRow label="Category">
                        <select
                            className={selectClass}
                            value={selectedCategory?.id ?? ""}
                            onChange={(e) => onCategoryChange(e.target.value)}
                        >
                            <option value="" disabled>
                                Select…
                            </option>
                            {selectedCategory &&
                                !categories.some((c) => c.id === selectedCategory.id) && (
                                    <option value={selectedCategory.id}>{selectedCategory.name}</option>
                                )}
                            {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                            <option value="__new__">+ New category</option>
                        </select>
                    </TaskPropertyRow>

                    <TaskPropertyRow label="Priority">
                        <div className="flex gap-1.5">
                            {PRIORITIES.map((p) => {
                                const active = form.priority === p.value;
                                return (
                                    <button
                                        key={p.value}
                                        type="button"
                                        onClick={() => setForm((prev) => ({ ...prev, priority: p.value }))}
                                        className={cn(
                                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-colors",
                                            active
                                                ? "border-primary bg-primary/15 text-primary"
                                                : "border-border text-muted-foreground hover:bg-muted",
                                        )}
                                    >
                                        {p.dot && <span className={cn("size-2 rounded-full", p.dot)} />}
                                        {p.label}
                                    </button>
                                );
                            })}
                        </div>
                    </TaskPropertyRow>

                    <TaskPropertyRow label="Difficulty">
                        <div className="flex gap-1.5">
                            {[1, 2, 3, 4, 5].map((n) => (
                                <button
                                    key={n}
                                    type="button"
                                    onClick={() => setForm((prev) => ({ ...prev, value: n }))}
                                    aria-label={`Difficulty ${n}`}
                                    className={cn(
                                        "size-4 rounded-full border transition-colors",
                                        n <= form.value
                                            ? "border-primary bg-primary"
                                            : "border-border hover:bg-muted",
                                    )}
                                />
                            ))}
                        </div>
                    </TaskPropertyRow>

                    <TaskPropertyRow label="Public">
                        <Switch
                            checked={form.isPublic}
                            onCheckedChange={(v) => setForm((prev) => ({ ...prev, isPublic: v }))}
                        />
                    </TaskPropertyRow>

                    <TaskPropertyRow label="Deadline">
                        <Input
                            type="datetime-local"
                            value={isoToLocalInput(form.deadline)}
                            onChange={(e) =>
                                setForm((prev) => ({ ...prev, deadline: localToIso(e.target.value) }))
                            }
                            className="w-auto"
                        />
                    </TaskPropertyRow>
                </div>

                <button
                    type="button"
                    onClick={() => setAdvanced((a) => !a)}
                    className="mt-4 flex items-center gap-1 self-start text-muted-foreground hover:text-foreground"
                >
                    {advanced ? <CaretDown size={14} /> : <CaretRight size={14} />}
                    <ThemedText type="caption" className="text-inherit">
                        Advanced
                    </ThemedText>
                </button>

                {advanced && (
                    <div className="mt-3 flex flex-col gap-4 border-t pt-4">
                        <TaskPropertyRow label="Start">
                            <Input
                                type="datetime-local"
                                value={isoToLocalInput(form.startDate)}
                                onChange={(e) => {
                                    const iso = localToIso(e.target.value);
                                    setForm((prev) => ({ ...prev, startDate: iso, startTime: iso }));
                                }}
                                className="w-auto"
                            />
                        </TaskPropertyRow>

                        <RecurrenceFields form={form} setForm={setForm} />
                        <ReminderFields form={form} setForm={setForm} />

                        <TaskPropertyRow label="Integration">
                            <select
                                className={selectClass}
                                value={form.integration}
                                onChange={(e) =>
                                    setForm((prev) => ({ ...prev, integration: e.target.value }))
                                }
                            >
                                {INTEGRATIONS.map((i) => (
                                    <option key={i.value || "none"} value={i.value}>
                                        {i.label}
                                    </option>
                                ))}
                            </select>
                        </TaskPropertyRow>

                        {friends && friends.length > 0 && (
                            <div className="flex flex-col gap-2">
                                <ThemedText type="caption" className="text-muted-foreground">
                                    Tag friends
                                </ThemedText>
                                <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                                    {friends.map((friend) => {
                                        const checked = form.taggedUserIds.includes(friend._id);
                                        return (
                                            <label
                                                key={friend._id}
                                                className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-muted"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => toggleFriend(friend._id)}
                                                    className="size-4 accent-primary"
                                                />
                                                <ThemedText type="default" className="text-sm">
                                                    {friend.display_name || friend.handle}
                                                </ThemedText>
                                                <ThemedText type="caption" className="text-muted-foreground">
                                                    {friend.handle}
                                                </ThemedText>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="mt-6 flex items-center justify-between gap-2">
                    <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <PrimaryButton
                        title="Create task"
                        onClick={submit}
                        disabled={!canSubmit}
                        className="w-auto px-5 py-2"
                    >
                        <Plus size={16} />
                    </PrimaryButton>
                </div>
            </DialogContent>
        </Dialog>
    );
}
