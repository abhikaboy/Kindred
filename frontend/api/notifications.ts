import { client } from "@/hooks/useTypedAPI";
import type { paths, components } from "./generated/types";
import { withAuthHeaders } from "./utils";
import { useRequest } from "@/hooks/useRequest";

// Extract the type definitions from the generated types
type NotificationDocument = components["schemas"]["NotificationDocument"];
type GetNotificationsOutputBody = components["schemas"]["GetNotificationsOutputBody"];
type MarkNotificationsReadOutputBody = components["schemas"]["MarkNotificationsReadOutputBody"];
type MarkAllNotificationsReadOutputBody = components["schemas"]["MarkAllNotificationsReadOutputBody"];
type DeleteNotificationOutputBody = components["schemas"]["DeleteNotificationOutputBody"];

/**
 * Get notifications for the authenticated user
 * @description Retrieve user's notifications with pagination support
 * @param limit - Maximum number of notifications to return (default: 20, max: 100)
 * @param skip - Number of notifications to skip for pagination (default: 0)
 * @returns Promise with notifications data including unread count
 * @throws {Error} When the request fails or user is not authenticated
 */
export const getNotifications = async (limit: number = 20, skip: number = 0): Promise<GetNotificationsOutputBody> => {
    try {
        const { request } = useRequest();
        const url = `/user/notifications?limit=${limit}&skip=${skip}`;
        const response = await request("GET", url);
        return response;
    } catch (error) {
        console.error("Error fetching notifications:", error);
        throw new Error("Failed to fetch notifications. Please try again later.");
    }
};

/**
 * Mark specific notifications as read
 * @description Update read status for specified notifications
 * @param notificationIds - Array of notification IDs to mark as read
 * @returns Promise that resolves when notifications are marked as read
 * @throws {Error} When the request fails or notification IDs are invalid
 */
export const markNotificationsAsRead = async (notificationIds: string[]): Promise<MarkNotificationsReadOutputBody> => {
    try {
        const { request } = useRequest();
        const response = await request("PATCH", "/user/notifications/read", {
            notification_ids: notificationIds
        });
        return response;
    } catch (error) {
        console.error("Error marking notifications as read:", error);
        throw new Error("Failed to mark notifications as read. Please try again later.");
    }
};

/**
 * Mark all notifications as read for the authenticated user
 * @description Mark all user's notifications as read
 * @returns Promise that resolves when all notifications are marked as read
 * @throws {Error} When the request fails or user is not authenticated
 */
export const markAllNotificationsAsRead = async (): Promise<MarkAllNotificationsReadOutputBody> => {
    try {
        const { request } = useRequest();
        const response = await request("PATCH", "/user/notifications/read-all");
        return response;
    } catch (error) {
        console.error("Error marking all notifications as read:", error);
        throw new Error("Failed to mark all notifications as read. Please try again later.");
    }
};

/**
 * Delete a specific notification
 * @description Remove a notification from the user's notification list
 * @param notificationId - The ID of the notification to delete
 * @returns Promise that resolves when notification is deleted
 * @throws {Error} When the request fails or notification ID is invalid
 */
export const deleteNotification = async (notificationId: string): Promise<DeleteNotificationOutputBody> => {
    try {
        const { request } = useRequest();
        const response = await request("DELETE", `/user/notifications/${notificationId}`);
        return response;
    } catch (error) {
        console.error("Error deleting notification:", error);
        throw new Error("Failed to delete notification. Please try again later.");
    }
};
