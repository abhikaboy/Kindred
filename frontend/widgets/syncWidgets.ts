import type { Task, Workspace } from '@/api/types';
import { activityAPI, convertToWeeklyActivityLevels } from '@/api/activity';
import { createLogger } from '@/utils/logger';
import {
    ActivityStreakWidgetUpdater,
    LockScreenCircularWidgetUpdater,
    LockScreenInlineWidgetUpdater,
    LockScreenRectangularWidgetUpdater,
    TodayTasksWidgetUpdater,
    WorkspaceSnapshotWidgetUpdater,
} from './widgetUpdaters';
import {
    buildNextTaskTimeline,
    buildStreakProps,
    buildTodayTimeline,
    buildWorkspaceProps,
    startOfLocalDay,
} from './widgetData';

const logger = createLogger('syncWidgets');

// Completed tasks live in a separate collection, so today's count is tracked
// here: seeded from the server, then bumped locally on each completion.
let completedToday = { day: 0, count: 0 };
let lastTasks: Task[] = [];
let lastWorkspaces: Workspace[] = [];
let lastStreak: { streak: number; levels: number[] } | null = null;

function completedTodayCount(now: number): number {
    return completedToday.day === startOfLocalDay(now) ? completedToday.count : 0;
}

export function syncTaskWidgets(tasks: Task[], workspaces: Workspace[], now = Date.now()): void {
    lastTasks = tasks;
    lastWorkspaces = workspaces;
    const completed = completedTodayCount(now);
    const today = buildTodayTimeline(tasks, completed, now);
    TodayTasksWidgetUpdater.updateTimeline(today);
    LockScreenCircularWidgetUpdater.updateTimeline(today);
    LockScreenRectangularWidgetUpdater.updateTimeline(buildNextTaskTimeline(tasks, now));

    const workspace = buildWorkspaceProps(workspaces, now);
    if (workspace) WorkspaceSnapshotWidgetUpdater.updateSnapshot(workspace);
}

function pushStreak(now: number): void {
    if (!lastStreak) return;
    const props = buildStreakProps(lastStreak.streak, completedTodayCount(now), lastStreak.levels, now);
    ActivityStreakWidgetUpdater.updateSnapshot(props);
    LockScreenInlineWidgetUpdater.updateSnapshot(props);
}

/** Re-reads the streak and 7-day activity from the server. */
export async function syncStreakWidgets(userId: string, streak: number): Promise<void> {
    let levels: number[] = new Array(7).fill(0);
    try {
        const recent = await activityAPI.getRecentActivity(userId);
        levels = convertToWeeklyActivityLevels(recent).slice(-7);
    } catch (error) {
        logger.error('Failed to load recent activity for streak widget', error);
        if (lastStreak) levels = lastStreak.levels;
    }
    lastStreak = { streak, levels };
    pushStreak(Date.now());
}

/** Seeds today's completed count from the server (app launch / foreground). */
export async function refreshCompletedToday(): Promise<void> {
    const now = Date.now();
    try {
        const tasks = await activityAPI.getCompletedTasksByDate(new Date(now));
        completedToday = { day: startOfLocalDay(now), count: tasks.length };
        syncTaskWidgets(lastTasks, lastWorkspaces, now);
        pushStreak(now);
    } catch (error) {
        logger.error('Failed to load completed tasks for widgets', error);
    }
}

/** Call after a task is completed so widgets update without a round trip. */
export function noteTaskCompleted(taskId: string, newStreak?: number): void {
    const now = Date.now();
    completedToday = { day: startOfLocalDay(now), count: completedTodayCount(now) + 1 };
    if (newStreak !== undefined && lastStreak) lastStreak = { ...lastStreak, streak: newStreak };
    syncTaskWidgets(lastTasks.filter((t) => t.id !== taskId), lastWorkspaces, now);
    pushStreak(now);
}
