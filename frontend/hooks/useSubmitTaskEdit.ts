import { Alert } from "react-native";
import type { components } from "@/api/generated/types";
import type { RecurDetails, Task } from "@/api/types";
import { updateTaskAPI, updateTemplateAPI } from "@/api/task";
import { useTasks } from "@/contexts/tasksContext";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import { useAnalytics } from "@/hooks/useAnalytics";
import { AnalyticsEvents } from "@/utils/analytics";
import { combineDateAndTime } from "@/utils/timeUtils";

const NO_REPEAT: RecurDetails = { every: 1, daysOfWeek: [0, 0, 0, 0, 0, 0, 0], behavior: "ROLLING" };

/**
 * Saves the task-creation context back onto `task`, filed in `categoryId`.
 * A recurring occurrence asks whether the change applies to future tasks too.
 * Resolves once the user has chosen (or cancelled); the context is reset on save.
 */
export function useSubmitTaskEdit() {
    const { updateTask } = useTasks();
    const { capture } = useAnalytics();
    const {
        taskName,
        priority,
        value,
        recurring,
        recurFrequency,
        recurDetails,
        flexDetails,
        deadline,
        startDate,
        startTime,
        reminders,
        isPublic,
        integration,
        resetTaskCreation,
    } = useTaskCreation();

    const content = taskName.replace(/[\n\r]+$/g, "").trim();
    const start = (startDate && startTime ? combineDateAndTime(startDate, startTime) : startDate)?.toISOString();
    const reminderBody = reminders.map((r) => ({ ...r, triggerTime: r.triggerTime.toISOString() }));
    const effectiveRecurring = recurring || !!flexDetails;

    const updateOccurrence = async (task: Task, categoryId: string) => {
        const details = effectiveRecurring
            ? ({ ...recurDetails, ...(flexDetails ? { flex: flexDetails } : {}) } as RecurDetails)
            : NO_REPEAT;
        const updateData: any = {
            content,
            priority,
            value,
            recurring: effectiveRecurring,
            public: isPublic,
            active: task.active || false,
            recurDetails: details,
            startDate: start,
            startTime: startTime?.toISOString(),
            deadline: deadline?.toISOString(),
            reminders: reminderBody,
            notes: task.notes || "",
            checklist: task.checklist || [],
            integration: integration || undefined,
            generateTemplate: effectiveRecurring && (!task.recurring || !task.templateID),
        };
        if (effectiveRecurring) updateData.recurFrequency = recurFrequency;

        updateTask(categoryId, task.id, updateData);
        try {
            await updateTaskAPI(categoryId, task.id, updateData);
            capture(AnalyticsEvents.TASK_UPDATED, { source: "edit_modal" });
        } catch (error) {
            console.error("Failed to update task:", error);
            const { showToastable } = await import("react-native-toastable");
            showToastable({ message: "Failed to update task. Please try again.", status: "danger", duration: 3000 });
        }
    };

    const updateTemplate = async (task: Task) => {
        if (!task.templateID) return;
        const body: components["schemas"]["UpdateTemplateDocument"] = {
            content,
            priority,
            value,
            public: isPublic,
            recurDetails: recurring ? (recurDetails as RecurDetails) : undefined,
            recurFrequency: recurring ? recurFrequency : undefined,
            startDate: start,
            startTime: startTime?.toISOString(),
            deadline: deadline?.toISOString(),
            reminders: reminderBody,
            notes: task.notes || "",
            checklist: task.checklist || [],
        };
        try {
            await updateTemplateAPI(task.templateID, body);
        } catch (error) {
            console.error("Failed to update template:", error);
        }
    };

    /** Resolves true when saved, false when the user backed out. */
    return (task: Task, categoryId: string) =>
        new Promise<boolean>((resolve) => {
            const save = async (future: boolean) => {
                await updateOccurrence(task, categoryId);
                if (future) await updateTemplate(task);
                resetTaskCreation();
                resolve(true);
            };
            if (!task.templateID) {
                void save(false);
                return;
            }
            Alert.alert("Update Recurring Task", "Do you want to update only this occurrence or all future tasks?", [
                { text: "Only This Task", onPress: () => void save(false) },
                { text: "All Future Tasks", onPress: () => void save(true) },
                { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            ]);
        });
}
