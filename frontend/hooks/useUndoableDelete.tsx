import React, { useRef, useEffect, useCallback, useState } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { showToastable, hideToastable } from "react-native-toastable";
import { useTaskActions } from "@/contexts/tasksContext";
import { removeFromCategoryAPI, bulkDeleteTasksAPI } from "@/api/task";
import { Task } from "@/api/types";
import CustomAlert, { AlertButton } from "@/components/modals/CustomAlert";
import UndoToast from "@/components/ui/UndoToast";
import DefaultToast from "@/components/ui/DefaultToast";
import { useAnalytics } from "@/hooks/useAnalytics";
import { AnalyticsEvents } from "@/utils/analytics";

const UNDO_DELAY_MS = 5000;

interface PendingDelete {
    task: Task;
    categoryId: string;
    deleteRecurring: boolean;
}

export function useUndoableDelete() {
    const { removeFromCategory, addToCategory } = useTaskActions();
    const { capture } = useAnalytics();
    const pendingRef = useRef<Map<string, PendingDelete>>(new Map<string, PendingDelete>());
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // Recurring-task dialog buttons; null = closed (the alert only mounts when open)
    const [alertButtons, setAlertButtons] = useState<AlertButton[] | null>(null);
    const setAlertVisible = useCallback((visible: boolean) => {
        if (!visible) setAlertButtons(null);
    }, []);

    const flushPending = useCallback(async () => {
        const entries = Array.from(pendingRef.current.values());
        pendingRef.current.clear();
        if (entries.length === 0) return;

        // Partition: recurring-template deletes need individual calls
        const individual: PendingDelete[] = [];
        const bulkable: PendingDelete[] = [];

        for (const entry of entries) {
            if (entry.deleteRecurring) {
                individual.push(entry);
            } else {
                bulkable.push(entry);
            }
        }

        // Fire bulk delete for non-recurring
        if (bulkable.length > 0) {
            try {
                if (bulkable.length === 1) {
                    const { categoryId, task } = bulkable[0];
                    await removeFromCategoryAPI(categoryId, task.id, false);
                    capture(AnalyticsEvents.TASK_DELETED, {
                        count: 1,
                    });
                } else {
                    await bulkDeleteTasksAPI(
                        bulkable.map(({ categoryId, task }) => ({
                            categoryId,
                            taskId: task.id,
                            deleteRecurring: false,
                        }))
                    );
                    capture(AnalyticsEvents.TASK_BULK_DELETED, {
                        count: bulkable.length,
                    });
                }
            } catch (error) {
                // Restore failed tasks to UI
                for (const { categoryId, task } of bulkable) {
                    addToCategory(categoryId, task);
                }
                showToastable({
                    title: "Error",
                    status: "danger",
                    position: "top",
                    message: "Failed to delete task(s)",
                    swipeDirection: "up",
                    renderContent: (props) => <DefaultToast {...props} />,
                });
            }
        }

        // Fire individual calls for recurring-template deletes
        for (const entry of individual) {
            try {
                await removeFromCategoryAPI(entry.categoryId, entry.task.id, true);
                capture(AnalyticsEvents.TASK_DELETED, {
                    count: 1,
                });
            } catch (error) {
                addToCategory(entry.categoryId, entry.task);
                showToastable({
                    title: "Error",
                    status: "danger",
                    position: "top",
                    message: `Failed to delete "${entry.task.content}"`,
                    swipeDirection: "up",
                    renderContent: (props) => <DefaultToast {...props} />,
                });
            }
        }
    }, [addToCategory, capture]);

    // On unmount: flush immediately (no more undo possible)
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = undefined;
            }
            flushPending();
        };
    }, [flushPending]);

    const undoAll = useCallback(() => {
        // Clear the timer
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = undefined;
        }

        // Restore all pending tasks
        for (const { categoryId, task } of pendingRef.current.values()) {
            addToCategory(categoryId, task);
        }
        pendingRef.current.clear();
        hideToastable();
    }, [addToCategory]);

    const scheduleFlush = useCallback(() => {
        // Clear existing timer
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        const count = pendingRef.current.size;

        // Show/update the undo toast
        showToastable({
            title: "Deleted",
            message: count === 1 ? "1 task deleted" : `${count} tasks deleted`,
            status: "warning",
            position: "top",
            duration: UNDO_DELAY_MS,
            swipeDirection: "up",
            renderContent: (props) => (
                <UndoToast {...props} onUndo={undoAll} count={count} />
            ),
        });

        // Start new timer
        timerRef.current = setTimeout(() => {
            timerRef.current = undefined;
            flushPending();
        }, UNDO_DELAY_MS);
    }, [undoAll, flushPending]);

    const enqueuePendingDelete = useCallback(
        (task: Task, categoryId: string, deleteRecurring: boolean) => {
            // Snapshot the task into the pending map
            pendingRef.current.set(task.id, {
                task: { ...task },
                categoryId,
                deleteRecurring,
            });

            // Optimistic UI removal
            removeFromCategory(categoryId, task.id);

            // Haptic feedback
            if (Platform.OS === "ios") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }

            // Schedule (or reschedule) the flush
            scheduleFlush();
        },
        [removeFromCategory, scheduleFlush]
    );

    const deleteWithUndo = useCallback(
        (task: Task, categoryId: string) => {
            if (task.templateID) {
                // Show recurring task dialog
                setAlertButtons([
                    {
                        text: "Cancel",
                        style: "cancel",
                    },
                    {
                        text: "Only This Task",
                        onPress: () => enqueuePendingDelete(task, categoryId, false),
                    },
                    {
                        text: "All Future Tasks",
                        onPress: () => enqueuePendingDelete(task, categoryId, true),
                        style: "destructive",
                    },
                ]);
            } else {
                enqueuePendingDelete(task, categoryId, false);
            }
        },
        [enqueuePendingDelete]
    );

    const alertElement = alertButtons ? (
        <CustomAlert
            visible={true}
            setVisible={setAlertVisible}
            title="Delete Recurring Task"
            message="Do you want to delete only this task or all future tasks?"
            buttons={alertButtons}
        />
    ) : null;

    return { deleteWithUndo, alertElement };
}
