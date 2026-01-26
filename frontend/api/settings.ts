import { client } from "@/hooks/useTypedAPI";
import type { components } from "./generated/types";
import { withAuthHeaders } from "./utils";

// Extract type definitions from generated types
export type UserSettings = components["schemas"]["UserSettings"];
export type NotificationSettings = components["schemas"]["NotificationSettings"];
export type DisplaySettings = components["schemas"]["DisplaySettings"];

/**
 * Get user settings
 * Retrieves all settings for the authenticated user
 */
export const getUserSettings = async (): Promise<UserSettings> => {
    const { data, error } = await client.GET("/v1/user/settings", {
        params: withAuthHeaders({}),
    });

    if (error) {
        throw new Error(`Failed to get user settings: ${JSON.stringify(error)}`);
    }

    if (!data) {
        throw new Error("No settings data returned");
    }

    return data;
};

/**
 * Update user settings
 * Updates settings for the authenticated user (supports partial updates)
 */
export const updateUserSettings = async (settings: Partial<UserSettings>): Promise<{ message: string }> => {
    const { data, error } = await client.PATCH("/v1/user/settings", {
        params: withAuthHeaders({}),
        body: settings as UserSettings,
    });

    if (error) {
        throw new Error(`Failed to update user settings: ${JSON.stringify(error)}`);
    }

    if (!data) {
        throw new Error("No response data returned");
    }

    return data;
};

/**
 * Update notification settings only
 * Convenience method for updating just notification preferences
 */
export const updateNotificationSettings = async (
    notifications: Partial<NotificationSettings>
): Promise<{ message: string }> => {
    // Fetch current settings first to merge with the update
    const currentSettings = await getUserSettings();
    
    return updateUserSettings({
        ...currentSettings,
        notifications: {
            ...currentSettings.notifications,
            ...notifications,
        },
    });
};

/**
 * Update display settings only
 * Convenience method for updating just display preferences
 */
export const updateDisplaySettings = async (display: Partial<DisplaySettings>): Promise<{ message: string }> => {
    // Fetch current settings first to merge with the update
    const currentSettings = await getUserSettings();
    
    return updateUserSettings({
        ...currentSettings,
        display: {
            ...currentSettings.display,
            ...display,
        },
    });
};

/**
 * Update check-in frequency
 * Convenience method for updating just the check-in frequency
 */
export const updateCheckinFrequency = async (
    frequency: "none" | "occasionally" | "regularly" | "frequently"
): Promise<{ message: string }> => {
    // Fetch current settings first to merge with the update
    const currentSettings = await getUserSettings();
    
    return updateUserSettings({
        ...currentSettings,
        notifications: {
            ...currentSettings.notifications,
            checkin_frequency: frequency,
        },
    });
};
