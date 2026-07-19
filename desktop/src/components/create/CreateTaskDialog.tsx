import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import PrimaryButton from "@/components/PrimaryButton";
import { PropertyPill } from "@/components/create/PropertyPill";
import { CategoryPopover } from "@/components/create/CategoryPopover";
import { PriorityPopover } from "@/components/create/PriorityPopover";
import { TaskTimeline } from "@/components/create/TaskTimeline";
import { RepeatPopover } from "@/components/create/RepeatPopover";
import { MorePopover } from "@/components/create/MorePopover";
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

export function CreateTaskDialog({
    open,
    onOpenChange,
    prefill,
    onRequestNewCategory,
}: CreateTaskDialogProps) {
    const [form, setForm] = useState<TaskFormState>(emptyTaskForm);
    const [selectedCategory, setSelectedCategory] = useState<SelectedCategory | null>(null);
    const titleRef = useRef<HTMLTextAreaElement>(null);
    const submitRef = useRef<HTMLButtonElement>(null);

    const { data: workspaces } = useWorkspaces();
    const { data: friends } = useFriends();
    const createTask = useCreateTask();

    const allCategories = useMemo<SelectedCategory[]>(
        () =>
            (workspaces ?? []).flatMap((ws) =>
                ws.categories.map((c) => ({ id: c.id, name: c.name, workspaceName: c.workspaceName })),
            ),
        [workspaces],
    );
    const firstWorkspaceName = workspaces?.[0]?.name;

    // Reset form + seed category/date-time from prefill each time the dialog opens.
    useEffect(() => {
        if (!open) return;
        setForm({
            ...emptyTaskForm(),
            deadline: prefill?.deadline ?? null,
            startDate: prefill?.startDate ?? null,
            startTime: prefill?.startTime ?? null,
        });
        setSelectedCategory(prefill?.categoryId ? allCategories.find((c) => c.id === prefill.categoryId) ?? null : null);
        const raf = requestAnimationFrame(() => titleRef.current?.focus());
        return () => cancelAnimationFrame(raf);
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

    // Shift / Cmd / Ctrl + Enter creates the task from anywhere in the dialog.
    const onKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey || e.shiftKey) && e.key === "Enter") {
            e.preventDefault();
            submit();
        }
    };

    // Plain Enter in the (single-line) title moves focus to Create; a second
    // Enter then fires it. Shift+Enter still creates immediately via onKeyDown.
    const onTitleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            submitRef.current?.focus();
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="gap-0" onKeyDown={onKeyDown}>
                <div className="-ml-2 pr-6">
                    <CategoryPopover
                        breadcrumb
                        workspaces={workspaces ?? []}
                        selected={selectedCategory}
                        onSelect={setSelectedCategory}
                        onNew={() =>
                            onRequestNewCategory(selectedCategory?.workspaceName ?? firstWorkspaceName, setSelectedCategory)
                        }
                    />
                </div>

                <div className="flex flex-col gap-3 py-5">
                    <textarea
                        ref={titleRef}
                        rows={1}
                        value={form.content}
                        onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                        onKeyDown={onTitleKeyDown}
                        placeholder="Task title"
                        className="w-full resize-none bg-transparent text-2xl font-medium leading-snug text-foreground outline-none placeholder:text-muted-foreground/50"
                    />
                    <textarea
                        rows={4}
                        value={form.notes}
                        onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                        placeholder="Add a description…"
                        className="min-h-24 w-full resize-none bg-transparent text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
                    />
                </div>

                <TaskTimeline form={form} setForm={setForm} />

                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <PriorityPopover
                        value={form.priority}
                        onChange={(priority) => setForm((prev) => ({ ...prev, priority }))}
                    />
                    <RepeatPopover form={form} setForm={setForm} />
                    <PropertyPill
                        active={form.isPublic}
                        icon={form.isPublic ? <Eye size={14} /> : <EyeSlash size={14} />}
                        onClick={() => setForm((prev) => ({ ...prev, isPublic: !prev.isPublic }))}
                    >
                        {form.isPublic ? "Public" : "Private"}
                    </PropertyPill>
                    <MorePopover form={form} setForm={setForm} friends={friends} />
                </div>

                <div className="mt-6 flex items-center justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <PrimaryButton
                        ref={submitRef}
                        title="Create task"
                        onClick={submit}
                        disabled={!canSubmit}
                        className="w-auto px-5 py-2"
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
