import { useMemo } from "react";
import { useTasks } from "@/contexts/tasksContext";
import { isSameDay, startOfDay, endOfDay, isWithinInterval } from "date-fns";

export const useDailyTasks = (selectedDate: Date) => {
    const { allTasks } = useTasks();

    // Filter tasks based on selected date
    const tasksForSelectedDate = useMemo(() => {
        const selectedDateStart = startOfDay(selectedDate);
        const selectedDateEnd = endOfDay(selectedDate);

        return allTasks.filter((task) => {
            if (task.startDate) {
                const taskStartDate = new Date(task.startDate);
                if (isSameDay(taskStartDate, selectedDate)) {
                    return true;
                }
            }

            if (task.deadline) {
                const taskDeadline = new Date(task.deadline);
                if (isSameDay(taskDeadline, selectedDate)) {
                    return true;
                }
            }

            if (task.startDate && task.deadline) {
                const taskStartDate = new Date(task.startDate);
                const taskDeadline = new Date(task.deadline);
                if (isWithinInterval(selectedDate, { start: taskStartDate, end: taskDeadline })) {
                    return true;
                }
            }

            return false;
        });
    }, [allTasks, selectedDate]);

    // Filter for Calendar View
    const tasksWithSpecificTime = useMemo(() => {
        return tasksForSelectedDate.filter((task) => {
            // Strictly require startTime to be present
            if (task.startTime) return true;
            
            // Fallback: check if startDate has specific time AND startTime is not explicitly null (if data structure allows)
            // But user feedback suggests we should be stricter.
            // If startTime is missing, but startDate has time, it might be timezone noise.
            // Let's trust startTime if it exists. If not, check if startDate is NOT midnight.
            if (task.startDate) {
                const taskDate = new Date(task.startDate);
                const hasTime = taskDate.getHours() !== 0 || taskDate.getMinutes() !== 0 || taskDate.getSeconds() !== 0;
                
                // Only treat as specific time if it has non-zero time AND we don't have a conflicting signal
                // For now, we'll assume that if it has a time component, it's intentional, 
                // UNLESS it looks like a default UTC midnight in local time.
                // But determining "default UTC midnight" depends on user timezone.
                // Safer bet: If startTime is missing, treat as "all day" / "no specific time" unless clearly scheduled.
                // Actually, the previous logic WAS checking for non-zero time.
                // The user said "tasks without a start time" (implies null startTime).
                // So we should probably ONLY rely on startTime for specific placement if possible.
                
                // Proposed fix: Only use startTime.
                // If tasks migrate from legacy system using startDate as time, this might break them.
                // But for new tasks, startTime should be used.
                return false; 
            }
            return false;
        });
    }, [tasksForSelectedDate]);

    const tasksForTodayNoTime = useMemo(() => {
        return tasksForSelectedDate.filter((task) => {
            // Include tasks that don't have a specific startTime
            if (!task.startTime) return true;
            return false;
        });
    }, [tasksForSelectedDate]);

    const tasksUnscheduled = useMemo(() => {
        return tasksForSelectedDate.filter((task) => {
            return !task.startDate && !task.startTime;
        });
    }, [tasksForSelectedDate]);

    // Filter lists for List View
    const listUnscheduledTasks = useMemo(() => {
        return allTasks.filter((task) => !task.startDate && !task.deadline);
    }, [allTasks]);

    const upcomingTasks = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return allTasks.filter((task) => {
            if (task.startDate) {
                const taskStartDate = new Date(task.startDate);
                taskStartDate.setHours(0, 0, 0, 0);
                if (taskStartDate > today) return true;
            }
            if (task.deadline && !task.startDate) {
                const taskDeadline = new Date(task.deadline);
                taskDeadline.setHours(0, 0, 0, 0);
                if (taskDeadline > today) return true;
            }
            if (task.startDate && task.deadline) {
                const taskStartDate = new Date(task.startDate);
                taskStartDate.setHours(0, 0, 0, 0);
                const taskDeadline = new Date(task.deadline);
                taskDeadline.setHours(0, 0, 0, 0);
                if (taskStartDate <= today && taskDeadline > today) return true;
            }
            return false;
        });
    }, [allTasks]);

    const pastTasks = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return allTasks.filter((task) => {
            if (!task.startDate) return false;
            const taskStartDate = new Date(task.startDate);
            taskStartDate.setHours(0, 0, 0, 0);
            const isPastStart = taskStartDate < today;
            const hasNoDeadline = !task.deadline;
            return isPastStart && hasNoDeadline;
        });
    }, [allTasks]);

    const overdueTasks = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return allTasks.filter((task) => {
            if (!task.deadline) return false;
            const taskDeadline = new Date(task.deadline);
            taskDeadline.setHours(0, 0, 0, 0);
            return taskDeadline < today;
        });
    }, [allTasks]);

    return {
        tasksForSelectedDate,
        tasksWithSpecificTime,
        tasksForTodayNoTime,
        tasksUnscheduled,
        listUnscheduledTasks,
        upcomingTasks,
        pastTasks,
        overdueTasks,
    };
};

