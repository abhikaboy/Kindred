import React, { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { markAsCompletedAPI } from '@/api/task';
import { useTasks } from '@/contexts/tasksContext';
import { showToastable } from 'react-native-toastable';
import TaskToast from '@/components/ui/TaskToast';
import DefaultToast from '@/components/ui/DefaultToast';

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
    const { removeFromCategory, setShowConfetti, categories } = useTasks();

    const markTaskAsCompleted = useCallback(async (
        categoryId: string,
        taskId: string,
        task: TaskCompletionData,
        categoryName?: string
    ) => {
        if (isCompleting) return;
        
        setIsCompleting(true);
        try {
            const res = await markAsCompletedAPI(categoryId, taskId, {
                timeCompleted: new Date().toISOString(),
                timeTaken: new Date().toISOString(),
            });
            console.log("Task completion result:", res);

            // Only update UI state after successful API call
            removeFromCategory(categoryId, taskId);
            
            // Show confetti and automatically hide it after 2 seconds
            setShowConfetti(true);
            setTimeout(() => {
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

            // Show streak notification if streak changed
            const newStreakInfo = (res as any)?.newStreakInfo;
            
            // Build title and message based on streak status
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

            options?.onSuccess?.();
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
            options?.onError?.(error);
        } finally {
            setIsCompleting(false);
        }
    }, [isCompleting, removeFromCategory, setShowConfetti, categories, options]);

    return {
        markTaskAsCompleted,
        isCompleting,
    };
};

