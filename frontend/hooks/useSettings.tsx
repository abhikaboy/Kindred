import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getUserSettings,
    updateUserSettings,
    updateNotificationSettings,
    updateDisplaySettings,
    updateCheckinFrequency,
    updateDashboardConfiguration,
    type UserSettings,
    type NotificationSettings,
    type DisplaySettings,
    type DashboardConfiguration,
} from "@/api/settings";
import { showToast } from "@/utils/showToast";

/**
 * Query key factory for settings
 */
export const settingsKeys = {
    all: ["settings"] as const,
    user: () => [...settingsKeys.all, "user"] as const,
};

/**
 * Hook to fetch user settings
 */
export function useUserSettings() {
    return useQuery({
        queryKey: settingsKeys.user(),
        queryFn: getUserSettings,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    });
}

/**
 * Hook to update user settings
 */
export function useUpdateSettings() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (settings: Partial<UserSettings>) => updateUserSettings(settings),
        onSuccess: (data, variables) => {
            // Optimistically update the cache
            queryClient.setQueryData(settingsKeys.user(), (old: UserSettings | undefined) => {
                if (!old) return old;
                return {
                    ...old,
                    ...variables,
                    notifications: {
                        ...old.notifications,
                        ...(variables.notifications || {}),
                    },
                    display: {
                        ...old.display,
                        ...(variables.display || {}),
                    },
                    dashboard_configuration: {
                        ...old.dashboard_configuration,
                        ...(variables.dashboard_configuration || {}),
                    },
                };
            });

            // Invalidate to refetch and ensure consistency
            queryClient.invalidateQueries({ queryKey: settingsKeys.user() });

            showToast("Settings updated successfully", "success");
        },
        onError: (error) => {
            console.error("Failed to update settings:", error);
            showToast("Failed to update settings", "danger");
        },
    });
}

/**
 * Hook to update notification settings only
 */
export function useUpdateNotificationSettings() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (notifications: Partial<NotificationSettings>) => updateNotificationSettings(notifications),
        onSuccess: (data, variables) => {
            // Optimistically update the cache
            queryClient.setQueryData(settingsKeys.user(), (old: UserSettings | undefined) => {
                if (!old) return old;
                return {
                    ...old,
                    notifications: {
                        ...old.notifications,
                        ...variables,
                    },
                };
            });

            queryClient.invalidateQueries({ queryKey: settingsKeys.user() });
            showToast("Notification settings updated", "success");
        },
        onError: (error) => {
            console.error("Failed to update notification settings:", error);
            showToast("Failed to update notification settings", "danger");
        },
    });
}

/**
 * Hook to update display settings only
 */
export function useUpdateDisplaySettings() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (display: Partial<DisplaySettings>) => updateDisplaySettings(display),
        onSuccess: (data, variables) => {
            // Optimistically update the cache
            queryClient.setQueryData(settingsKeys.user(), (old: UserSettings | undefined) => {
                if (!old) return old;
                return {
                    ...old,
                    display: {
                        ...old.display,
                        ...variables,
                    },
                };
            });

            queryClient.invalidateQueries({ queryKey: settingsKeys.user() });
            showToast("Display settings updated", "success");
        },
        onError: (error) => {
            console.error("Failed to update display settings:", error);
            showToast("Failed to update display settings", "danger");
        },
    });
}

/**
 * Hook to update check-in frequency
 */
export function useUpdateCheckinFrequency() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (frequency: "none" | "occasionally" | "regularly" | "frequently") =>
            updateCheckinFrequency(frequency),
        onSuccess: (data, frequency) => {
            // Optimistically update the cache
            queryClient.setQueryData(settingsKeys.user(), (old: UserSettings | undefined) => {
                if (!old) return old;
                return {
                    ...old,
                    notifications: {
                        ...old.notifications,
                        checkin_frequency: frequency,
                    },
                };
            });

            queryClient.invalidateQueries({ queryKey: settingsKeys.user() });

            // Custom toast message based on frequency
            const messages = {
                none: "Check-ins disabled",
                occasionally: "Check-ins set to occasionally (1-2x per week)",
                regularly: "Check-ins set to regularly (3-4x per week)",
                frequently: "Check-ins set to frequently (daily)",
            };

            showToast(messages[frequency], "success");
        },
        onError: (error) => {
            console.error("Failed to update check-in frequency:", error);
            showToast("Failed to update check-in frequency", "danger");
        },
    });
}

/**
 * Hook to update dashboard configuration
 * No toast shown - silent background save for section visibility toggles
 */
export function useUpdateDashboardConfiguration() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (config: Partial<DashboardConfiguration>) => updateDashboardConfiguration(config),
        onMutate: async (variables) => {
            // Optimistically update immediately for snappy UI
            await queryClient.cancelQueries({ queryKey: settingsKeys.user() });
            const previous = queryClient.getQueryData<UserSettings>(settingsKeys.user());

            const defaultDashConfig = {
                stats: true, jump_back_in: true, kudos: true, upcoming: true,
                google_calendar: true, recent_workspaces: true, recently_completed: true,
            };
            queryClient.setQueryData(settingsKeys.user(), (old: UserSettings | undefined) => {
                if (!old) return old;
                return {
                    ...old,
                    dashboard_configuration: {
                        ...defaultDashConfig,
                        ...old.dashboard_configuration,
                        ...variables,
                    },
                };
            });

            return { previous };
        },
        onError: (error, variables, context) => {
            // Rollback on error
            if (context?.previous) {
                queryClient.setQueryData(settingsKeys.user(), context.previous);
            }
            console.error("Failed to update dashboard configuration:", error);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: settingsKeys.user() });
        },
    });
}

/**
 * Hook to toggle a specific setting
 * Useful for boolean settings like friend_activity, near_deadlines, etc.
 */
export function useToggleSetting() {
    const queryClient = useQueryClient();
    const { mutate: updateSettings } = useUpdateSettings();

    return (settingPath: string, currentValue: boolean) => {
        const [category, key] = settingPath.split(".");

        if (category === "notifications") {
            updateSettings({
                notifications: {
                    [key]: !currentValue,
                } as Partial<NotificationSettings>,
            });
        } else if (category === "display") {
            updateSettings({
                display: {
                    [key]: !currentValue,
                } as Partial<DisplaySettings>,
            });
        }
    };
}
