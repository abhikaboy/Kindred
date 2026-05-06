import React, { useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { markAsCompletedAPI } from '@/api/task';
import { useTasks } from '@/contexts/tasksContext';
import { Task } from '@/api/types';
import { showToastable } from 'react-native-toastable';
import TaskToast from '@/components/ui/TaskToast';
import DefaultToast from '@/components/ui/DefaultToast';
import { useAuth } from '@/hooks/useAuth';
import { updateStreakWidget } from '@/widgets/updateStreakWidget';

interface TaskCompletionData {
    id: string;
    content: string;
    value: number;
    public?: boolean;
}

interface UseTaskCompletionOptions {
    onSuccess?: () => void;
    onError?: (error: any) => void;
}

export const useTaskCompletion = (options?: UseTaskCompletionOptions) => {
    const [isCompleting, setIsCompleting] = useState(false);
    const isCompletingRef = useRef(false);
    const optionsRef = useRef(options);
    optionsRef.current = options;

    const { removeFromCategory, addToCategory, setShowConfetti, categories } = useTasks();
    const { user } = useAuth();
    const confettiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const markTaskAsCompleted = useCallback(async (
        categoryId: string,
        taskId: string,
        task: TaskCompletionData,
        categoryName?: string
    ) => {
        if (isCompletingRef.current) return;

        isCompletingRef.current = true;
        setIsCompleting(true);
        try {
            const res = await markAsCompletedAPI(categoryId, taskId, {
                timeCompleted: new Date().toISOString(),
                timeTaken: "PT0S",
            });

            removeFromCategory(categoryId, taskId);

            // If backend returned the next flex instance, insert it immediately
            if (res.nextFlexTask) {
                addToCategory(res.nextFlexTask.categoryId, {
                    ...res.nextFlexTask.task,
                    categoryID: res.nextFlexTask.categoryId,
                } as Task);
            }

            setShowConfetti(true);
            if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
            confettiTimeoutRef.current = setTimeout(() => {
                setShowConfetti(false);
            }, 2000);

            if (Platform.OS === "ios") {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

            const finalCategoryName =
                categoryName ||
                categories?.find((cat) => cat.id === categoryId)?.name ||
                "Unknown Category";

            const taskData = {
                id: task.id,
                name: task.content,
                category: categoryId,
                categoryName: finalCategoryName,
                points: task.value,
                public: task.public || false,
            };

            const newStreakInfo = (res as any)?.newStreakInfo;

            if (user?._id) {
                const newStreak = newStreakInfo?.newStreak ?? (user?.streak || 0);
                updateStreakWidget(user._id, newStreak, 1).catch(() => {});
            }

            let title = "Task completed!";
            let message = `Congrats! Click here to post and document your task!`;

            if (newStreakInfo) {
                const { oldStreak, newStreak } = newStreakInfo;
                const streakIncreased = newStreak > oldStreak;
                const isFirstCompletion = oldStreak === 0 && newStreak === 1;

                if (streakIncreased || isFirstCompletion) {
                    if (isFirstCompletion) {
                        title = "🎉 Task completed - Streak started!";
                        message = "You've started your streak! Click here to post and document your task!";
                    } else {
                        title = `🔥 Task completed - ${newStreak} day streak!`;
                        message = `Keep it up! You're on a ${newStreak} day streak! Click here to post!`;
                    }
                }
            }

            showToastable({
                title,
                status: "success",
                position: "top",
                swipeDirection: "up",
                duration: 5000,
                message,
                renderContent: (props) => <TaskToast {...props} taskData={taskData} />,
            });

            optionsRef.current?.onSuccess?.();
        } catch (error) {
            console.error("Error marking task as completed:", error);
            showToastable({
                title: "Error",
                status: "danger",
                position: "top",
                message: "Error completing task",
                swipeDirection: "up",
                renderContent: (props) => <DefaultToast {...props} />,
            });
            optionsRef.current?.onError?.(error);
        } finally {
            isCompletingRef.current = false;
            setIsCompleting(false);
        }
    }, [removeFromCategory, addToCategory, setShowConfetti, categories, user]);

    return {
        markTaskAsCompleted,
        isCompleting,
    };
};
