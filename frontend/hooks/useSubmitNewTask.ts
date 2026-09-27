import { ObjectId } from "bson";
import { useQueryClient } from "@tanstack/react-query";
import type { components } from "@/api/generated/types";
import type { RecurDetails } from "@/api/types";
import { respondToTaskTagAPI } from "@/api/task";
import { useTasks } from "@/contexts/tasksContext";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import { useRingUpdate } from "@/contexts/ringUpdateContext";
import { useApplyCreatedTasks } from "@/hooks/useApplyCreatedTasks";
import { useRequest } from "@/hooks/useRequest";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useAuth } from "@/hooks/useAuth";
import { promptAccountAfterTask } from "@/hooks/useAccountOverlay";
import { AnalyticsEvents } from "@/utils/analytics";
import { combineDateAndTime } from "@/utils/timeUtils";

type CreateTaskParams = components["schemas"]["CreateTaskParams"];

// Sentinel category id: the user declines to pick a category and the backend
// files the task from its Inbox in the background.
export const AUTO_CATEGORY_ID = "__auto__";

/**
 * Creates the task held in the task-creation context, in `categoryId` (or via
 * auto-sort for AUTO_CATEGORY_ID), then resets the context. Inserts
 * optimistically when the destination is known. Failures surface as a toast.
 */
export function useSubmitNewTask() {
    const { request } = useRequest();
    const { addToCategory, removeFromCategory } = useTasks();
    const { applyCreatedTask } = useApplyCreatedTasks();
    const { showRingUpdate } = useRingUpdate();
    const queryClient = useQueryClient();
    const { capture } = useAnalytics();
    const { user } = useAuth();
    const {
        taskName,
        priority,
        value,
        recurring,
        recurFrequency,
        recurDetails,
        flexDetails,
        deadline,
        startTime,
        startDate,
        reminders,
        isPublic,
        integration,
        taggedUsers,
        notes,
        checklist,
        copySourceTaskId,
        setCopySourceTaskId,
        resetTaskCreation,
    } = useTaskCreation();

    return async (categoryId: string) => {
        const autoCategorize = categoryId === AUTO_CATEGORY_ID;
        // Trim trailing newlines and whitespace from task name
        const content = taskName.replace(/[\n\r]+$/g, "").trim();
        const start = (startDate && startTime ? combineDateAndTime(startDate, startTime) : startDate)?.toISOString();
        const reminderBody = reminders.map((reminder) => ({
            ...reminder,
            triggerTime: reminder.triggerTime.toISOString(),
        }));

        const tempId = new ObjectId().toString();
        const optimisticTask: any = {
            id: tempId,
            content,
            priority,
            value,
            recurring,
            public: isPublic,
            active: false,
            checklist,
            notes,
            startDate: start,
            startTime: startTime?.toISOString(),
            deadline: deadline?.toISOString(),
            reminders: reminderBody,
            recurFrequency: recurring ? recurFrequency : undefined,
            recurDetails: recurring ? (recurDetails as any) : undefined,
            timestamp: new Date().toISOString(),
            lastEdited: new Date().toISOString(),
            userID: "", // Will be populated by backend
            categoryID: categoryId,
            posted: false,
        };

        // Auto-categorized tasks have no known destination category yet, so
        // there's nothing to insert into — the list refreshes after the create.
        if (!autoCategorize) addToCategory(categoryId, optimisticTask);
        resetTaskCreation();

        const postBody: any = {
            content,
            priority,
            value,
            recurring,
            public: isPublic,
            active: false,
            checklist,
            notes,
            startDate: start,
            startTime: startTime?.toISOString(),
            deadline: deadline?.toISOString(),
            reminders: reminderBody,
            integration: integration || undefined,
            taggedUserIds: taggedUsers.length > 0 ? taggedUsers.map((u) => u.id) : undefined,
        };
        if (recurring || flexDetails) {
            postBody.recurFrequency = recurFrequency;
            postBody.recurring = true;
            const details = { ...recurDetails } as any;
            if (flexDetails) details.flex = flexDetails;
            postBody.recurDetails = details as RecurDetails;
        }

        const failed = async () => {
            const { showToastable } = await import("react-native-toastable");
            showToastable({
                title: "Couldn't add task",
                message: "Something went wrong on our end. Give it another try.",
                status: "danger",
                duration: 3000,
            });
        };

        if (autoCategorize) {
            try {
                const response = await request("POST", "/user/tasks/auto", postBody as CreateTaskParams);
                // The task landed in the Inbox; insert it there (refetches only if the Inbox is new).
                applyCreatedTask(response as any);
                showRingUpdate((response as any)?.ringDelta);
                queryClient.invalidateQueries({ queryKey: ["rings", "today"] });
                capture(AnalyticsEvents.TASK_CREATED, {
                    source: "create_modal",
                    auto_categorize: true,
                    has_deadline: !!deadline,
                    has_checklist: false,
                });
                void promptAccountAfterTask(user);
                const { showToastable } = await import("react-native-toastable");
                showToastable({
                    message: "Added to your Inbox — we'll file it shortly.",
                    status: "success",
                    duration: 3000,
                });
            } catch (error) {
                console.error("Failed to create task:", error);
                await failed();
            }
            return;
        }

        try {
            const response = await request("POST", `/user/tasks/${categoryId}`, postBody as CreateTaskParams);
            // Swap the optimistic task for the real one so ids line up
            removeFromCategory(categoryId, tempId);
            addToCategory(categoryId, response);
            if (copySourceTaskId) {
                respondToTaskTagAPI(copySourceTaskId, "copied").catch(() => {});
                setCopySourceTaskId(null);
                queryClient.invalidateQueries({ queryKey: ["taskTags", "pending"] });
            }
            showRingUpdate((response as any)?.ringDelta);
            queryClient.invalidateQueries({ queryKey: ["rings", "today"] });
            capture(AnalyticsEvents.TASK_CREATED, {
                source: "create_modal",
                has_deadline: !!deadline,
                has_checklist: false,
            });
            void promptAccountAfterTask(user);
        } catch (error) {
            console.error("Failed to create task:", error);
            removeFromCategory(categoryId, tempId);
            await failed();
        }
    };
}
