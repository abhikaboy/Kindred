import { useEffect, useRef } from 'react';
import { useTasks } from '@/contexts/tasksContext';
import { tryStartActiveTaskActivity, tryStartDeadlineActivity } from '@/utils/liveActivityManager';
import type { Task } from '@/api/types';
import type { ActiveTaskActivityProps } from '@/widgets/ActiveTaskActivity';
import type { DeadlineCountdownProps } from '@/widgets/DeadlineCountdownActivity';

function buildActiveTaskProps(task: Task): ActiveTaskActivityProps {
    return {
        taskName: task.content,
        workspaceName: task.workspaceName || 'Tasks',
        startTime: task.startTime || new Date().toISOString(),
        endTime: task.deadline || undefined,
        hasEndTime: !!task.deadline,
        categoryId: task.categoryID || '',
        taskId: task.id,
    };
}

function buildDeadlineProps(task: Task): DeadlineCountdownProps {
    return {
        taskName: task.content,
        workspaceName: task.workspaceName || 'Tasks',
        deadline: task.deadline!,
        priority: task.priority,
        categoryId: task.categoryID || '',
        taskId: task.id,
        accentColor: '#8B5CF6',
        statusLabel: 'Due Soon',
    };
}

export function useLiveActivityScheduler(): void {
    const { allTasks } = useTasks();
    const tasksRef = useRef(allTasks);
    tasksRef.current = allTasks;

    useEffect(() => {
        function checkTasks() {
            const now = Date.now();
            const fiveMinAgo = now - 5 * 60 * 1000;
            const thirtyMinFromNow = now + 30 * 60 * 1000;
            const sixtyFiveMinFromNow = now + 65 * 60 * 1000;

            for (const task of tasksRef.current) {
                if (!task.active) continue;
                if ((task as any).timeCompleted) continue;

                if (task.startTime) {
                    const startMs = new Date(task.startTime).getTime();
                    if (startMs >= fiveMinAgo && startMs <= now) {
                        tryStartActiveTaskActivity(task.id, buildActiveTaskProps(task));
                    }
                }

                if (task.deadline) {
                    const deadlineMs = new Date(task.deadline).getTime();
                    if (deadlineMs >= thirtyMinFromNow && deadlineMs <= sixtyFiveMinFromNow) {
                        tryStartDeadlineActivity(task.id, buildDeadlineProps(task));
                    }
                }
            }
        }

        checkTasks();
        const intervalId = setInterval(checkTasks, 30 * 1000);
        return () => clearInterval(intervalId);
    }, []);
}
