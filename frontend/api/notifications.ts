import client from "@/api/client";
import type { paths, components } from "./generated/types";
import { withAuthHeaders } from "./utils";
import { request } from "@/hooks/useRequest";
import { createLogger } from "@/utils/logger";

const logger = createLogger('NotificationsAPI');

type NotificationDocument = components["schemas"]["NotificationDocument"];
type GetNotificationsOutputBody = components["schemas"]["GetNotificationsOutputBody"];
type MarkNotificationsReadOutputBody = components["schemas"]["MarkNotificationsReadOutputBody"];
type MarkAllNotificationsReadOutputBody = components["schemas"]["MarkAllNotificationsReadOutputBody"];
type DeleteNotificationOutputBody = components["schemas"]["DeleteNotificationOutputBody"];

export const getNotifications = async (limit: number = 20, skip: number = 0): Promise<GetNotificationsOutputBody> => {
    try {
        const url = `/user/notifications?limit=${limit}&skip=${skip}`;
        const response = await request("GET", url);
        return response;
    } catch (error) {
        logger.error("Error fetching notifications", error);
        throw new Error("Failed to fetch notifications. Please try again later.");
    }
};

export const markNotificationsAsRead = async (notificationIds: string[]): Promise<MarkNotificationsReadOutputBody> => {
    try {
        const response = await request("PATCH", "/user/notifications/read", {
            id: notificationIds
        });
        return response;
    } catch (error) {
        logger.error("Error marking notifications as read", error);
        throw new Error("Failed to mark notifications as read. Please try again later.");
    }
};

export const markAllNotificationsAsRead = async (): Promise<MarkAllNotificationsReadOutputBody> => {
    try {
        const response = await request("PATCH", "/user/notifications/read-all");
        return response;
    } catch (error) {
        logger.error("Error marking all notifications as read", error);
        throw new Error("Failed to mark all notifications as read. Please try again later.");
    }
};

export const deleteNotification = async (notificationId: string): Promise<DeleteNotificationOutputBody> => {
    try {
        const response = await request("DELETE", `/user/notifications/${notificationId}`);
        return response;
    } catch (error) {
        logger.error("Error deleting notification", error);
        throw new Error("Failed to delete notification. Please try again later.");
    }
};
