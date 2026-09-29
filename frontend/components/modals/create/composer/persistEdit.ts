import { ObjectId } from "bson";
import type { components } from "@/api/generated/types";
import type { RecurDetails, Task } from "@/api/types";
import { updateTaskAPI, updateTemplateAPI } from "@/api/task";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import { combineDateAndTime } from "@/utils/timeUtils";

type Fields = ReturnType<typeof useTaskCreation>;

const startIso = (f: Fields) =>
    (f.startDate && f.startTime ? combineDateAndTime(f.startDate, f.startTime) : f.startDate)?.toISOString();

const remindersIso = (f: Fields) =>
    f.reminders.map((reminder) => ({ ...reminder, triggerTime: reminder.triggerTime.toISOString() }));

const trimName = (name: string) => name.replace(/[\n\r]+$/g, "").trim();

/**
 * The old sheet's edit save: optimistic local update, then the API. Returns
 * whether the API call succeeded; failures toast.
 */
export async function persistTaskEdit(
    f: Fields,
    task: Task,
    targetCategoryId: string,
    updateTask: (categoryId: string, taskId: string, updates: Partial<Task>) => void
): Promise<boolean> {
    const effectiveRecurring = f.recurring || !!f.flexDetails;
    const effectiveRecurDetails: RecurDetails = effectiveRecurring
        ? ({ ...f.recurDetails, ...(f.flexDetails ? { flex: f.flexDetails } : {}) } as RecurDetails)
        : { every: 1, daysOfWeek: [0, 0, 0, 0, 0, 0, 0], behavior: "ROLLING" };

    const updateData: any = {
        content: trimName(f.taskName),
        priority: f.priority,
        value: f.value,
        recurring: effectiveRecurring,
        public: f.isPublic,
        active: task.active || false,
        recurDetails: effectiveRecurDetails,
        startDate: startIso(f),
        startTime: f.startTime?.toISOString(),
        deadline: f.deadline?.toISOString(),
        reminders: remindersIso(f),
        notes: task.notes || "",
        checklist: task.checklist || [],
        integration: f.integration || undefined,
    };
    if (effectiveRecurring) updateData.recurFrequency = f.recurFrequency;
    updateData.generateTemplate = effectiveRecurring && (!task.recurring || !task.templateID);

    updateTask(targetCategoryId, task.id, updateData);
    try {
        await updateTaskAPI(targetCategoryId, task.id, updateData);
        return true;
    } catch (error) {
        console.error("Failed to update task:", error);
        const { showToastable } = await import("react-native-toastable");
        showToastable({ message: "Failed to update task. Please try again.", status: "danger", duration: 3000 });
        return false;
    }
}

/** "All future tasks": the recurring template gets the same fields. */
export async function persistTemplateEdit(f: Fields, task: Task): Promise<void> {
    if (!task.templateID) return;
    try {
        const data: components["schemas"]["UpdateTemplateDocument"] = {
            content: f.taskName,
            priority: f.priority,
            value: f.value,
            public: f.isPublic,
            recurDetails: f.recurring ? (f.recurDetails as RecurDetails) : undefined,
            recurFrequency: f.recurring ? f.recurFrequency : undefined,
            startDate: startIso(f),
            startTime: f.startTime?.toISOString(),
            deadline: f.deadline?.toISOString(),
            reminders: remindersIso(f),
            notes: task.notes || "",
            checklist: task.checklist || [],
        };
        await updateTemplateAPI(task.templateID, data);
    } catch (error) {
        console.error("Failed to update template:", error);
    }
}

/** A blueprint task lives only in the blueprint being built until it's published. */
export function buildBlueprintTask(f: Fields, categoryId: string): components["schemas"]["TaskDocument"] {
    const now = new Date().toISOString();
    return {
        id: new ObjectId().toString(),
        content: trimName(f.taskName),
        priority: f.priority,
        value: f.value,
        recurring: f.recurring,
        public: f.isPublic,
        active: false,
        checklist: f.checklist,
        notes: f.notes,
        startDate: startIso(f),
        startTime: f.startTime?.toISOString(),
        deadline: f.deadline?.toISOString(),
        reminders: remindersIso(f) as any,
        recurFrequency: f.recurring ? f.recurFrequency : undefined,
        recurDetails: f.recurring ? (f.recurDetails as any) : undefined,
        timestamp: now,
        lastEdited: now,
        userID: "",
        categoryID: categoryId,
        posted: false,
    };
}
