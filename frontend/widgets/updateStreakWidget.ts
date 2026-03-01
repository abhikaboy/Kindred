import ActivityStreakWidget from './ActivityStreakWidget';
import { LockScreenInlineWidget } from './LockScreenWidgets';
import { activityAPI, convertToWeeklyActivityLevels } from '@/api/activity';
import { createLogger } from '@/utils/logger';

const logger = createLogger('updateStreakWidget');

export async function updateStreakWidget(
    userId: string,
    streak: number,
    tasksCompletedToday: number,
): Promise<void> {
    try {
        const recentActivity = await activityAPI.getRecentActivity(userId);
        const allLevels = convertToWeeklyActivityLevels(recentActivity);
        // convertToWeeklyActivityLevels returns 8 values; take the last 7
        const weeklyLevels = allLevels.slice(-7);

        ActivityStreakWidget.updateSnapshot({ streak, tasksCompletedToday, weeklyLevels });
        LockScreenInlineWidget.updateSnapshot({ streak });
    } catch (error) {
        logger.error('Failed to update streak widget', error);
        ActivityStreakWidget.updateSnapshot({
            streak,
            tasksCompletedToday,
            weeklyLevels: new Array(7).fill(0),
        });
        LockScreenInlineWidget.updateSnapshot({ streak });
    }
}
