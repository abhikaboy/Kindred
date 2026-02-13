import { client } from "@/hooks/useTypedAPI";
import { components } from './generated/types';
import { withAuthHeaders } from "./utils";
import { createLogger } from "@/utils/logger";

const logger = createLogger('ActivityAPI');

// Use generated types
export type ActivityDocument = components['schemas']['ActivityDocument'];
export type ActivityDay = components['schemas']['ActivityDay'];
export type TaskDocument = components['schemas']['TaskDocument'];

// API functions
export const activityAPI = {
  // Get recent activity for the last 8 days
  async getRecentActivity(userId: string): Promise<ActivityDocument[]> {
    try {
      const { data, error } = await client.GET('/v1/activity/user/{userID}/recent', {
        params: withAuthHeaders({ path: { userID: userId } })
      });

      if (error) {
        throw new Error(`Failed to fetch recent activity: ${JSON.stringify(error)}`);
      }

      return data || [];
    } catch (error) {
      logger.error('Error fetching recent activity', error);
      throw error;
    }
  },

  // Get activity for a specific user, year, and month
  async getActivityByUserAndPeriod(userId: string, year: number, month: number): Promise<ActivityDocument | null> {
    try {
      const { data, error } = await client.GET('/v1/activity/user/{userID}', {
        params: withAuthHeaders({
          path: { userID: userId },
          query: { year, month }
        })
      });

      if (error) {
        if (error.status === 404) {
          return null; // No activity found for this period
        }
        throw new Error(`Failed to fetch activity: ${JSON.stringify(error)}`);
      }

      return data || null;
    } catch (error) {
      logger.error('Error fetching activity by user and period', error);
      throw error;
    }
  },

  // Get all activities for a user (for the activity page)
  async getAllUserActivity(userId: string, year: number): Promise<ActivityDocument[]> {
    try {
      const { data, error } = await client.GET('/v1/activity/user/{userID}/year', {
        params: withAuthHeaders({
          path: { userID: userId },
          query: { year }
        })
      });

      if (error) {
        throw new Error(`Failed to fetch yearly activity: ${JSON.stringify(error)}`);
      }

      return data || [];
    } catch (error) {
      logger.error('Error fetching all user activity', error);
      throw error;
    }
  },

  // Get completed tasks for a specific date
  async getCompletedTasksByDate(date: Date): Promise<TaskDocument[]> {
    try {
      // Format date as YYYY-MM-DD using local time components to avoid UTC shifting
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      logger.debug('getCompletedTasksByDate: Fetching tasks for date', {
        date: date.toISOString(),
        dateStr,
        timezone
      });

      const { data, error } = await client.GET('/v1/user/tasks/completed/date', {
        params: withAuthHeaders({
          query: {
            date: dateStr,
            timezone: timezone
          }
        })
      });

      logger.debug('getCompletedTasksByDate: Response received', {
        hasData: !!data,
        hasError: !!error,
        taskCount: data?.tasks?.length || 0
      });

      if (error) {
        logger.error('getCompletedTasksByDate: Error occurred', error);
        throw new Error(`Failed to fetch completed tasks by date: ${JSON.stringify(error)}`);
      }

      const tasks = data?.tasks || [];
      logger.debug('getCompletedTasksByDate: Returning tasks', { count: tasks.length });

      return tasks;
    } catch (error) {
      logger.error('getCompletedTasksByDate: Exception caught', error);
      throw error;
    }
  }
};

// Helper function to calculate activity level from count
export function calculateActivityLevel(count: number): number {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 10) return 3;
  return 4; // count > 10
}

// Helper function to convert activity data to weekly activity levels
export function convertToWeeklyActivityLevels(activities: ActivityDocument[]): number[] {
  const weeklyLevels: number[] = new Array(8).fill(0); // 8 days (last 7 days + today)

  if (!activities || activities.length === 0) {
    return weeklyLevels;
  }

  const today = new Date();
  const daysInWeek = 8;

  // Process each activity document
  activities.forEach(activity => {
    if (activity.days) {
      activity.days.forEach(day => {
        const activityDate = new Date(activity.year, activity.month - 1, day.day);
        const daysDiff = Math.floor((today.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24));

        // Check if this day is within the last 8 days
        if (daysDiff >= 0 && daysDiff < daysInWeek) {
          const index = daysInWeek - 1 - daysDiff; // Reverse order (most recent first)
          if (index >= 0 && index < weeklyLevels.length) {
            // Calculate level from count instead of using the level field
            weeklyLevels[index] = calculateActivityLevel(day.count);
          }
        }
      });
    }
  });

  return weeklyLevels;
}

// Helper function to get activity levels for a specific month
export function getMonthlyActivityLevels(activities: ActivityDocument[], year: number, month: number): number[] {
  const activity = activities.find(a => a.year === year && a.month === month);

  if (!activity || !activity.days) {
    // Return array of zeros for the number of days in the month
    const daysInMonth = new Date(year, month, 0).getDate();
    return new Array(daysInMonth).fill(0);
  }

  // Create array for all days in the month
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthlyLevels: number[] = new Array(daysInMonth).fill(0);

  // Fill in the activity levels for days that have data
  activity.days.forEach(day => {
    if (day.day >= 1 && day.day <= daysInMonth) {
      // Calculate level from count instead of using the level field
      monthlyLevels[day.day - 1] = calculateActivityLevel(day.count); // Convert to 0-indexed
    }
  });

  return monthlyLevels;
}
