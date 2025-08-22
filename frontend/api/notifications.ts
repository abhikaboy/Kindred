import { useRequest } from "@/hooks/useRequest";

export interface NotificationDocument {
    id: string;
    content: string;
    user: {
        id: string;
        display_name: string;
        handle: string;
        profile_picture: string;
    };
    time: string;
    notificationType: "ENCOURAGEMENT" | "COMMENT" | "CONGRATULATION";
    reference_id: string;
    read: boolean;
}

export interface NotificationsResponse {
    notifications: NotificationDocument[];
    unread_count: number;
    total: number;
}

// Get notifications for the authenticated user
export const getNotifications = async (limit: number = 20, skip: number = 0): Promise<NotificationsResponse> => {
    try {
        const { request } = useRequest();
        const url = `/api/v1/notifications?limit=${limit}&skip=${skip}`;
        return await request("GET", url);
    } catch (error) {
        console.error("Error fetching notifications:", error);
        throw error;
    }
};

// Mark specific notifications as read
export const markNotificationsAsRead = async (notificationIds: string[]): Promise<void> => {
    try {
        const { request } = useRequest();
        await request("PATCH", "/api/v1/notifications/read", {
            notification_ids: notificationIds
        });
    } catch (error) {
        console.error("Error marking notifications as read:", error);
        throw error;
    }
};

// Mark all notifications as read for the authenticated user
export const markAllNotificationsAsRead = async (): Promise<void> => {
    try {
        const { request } = useRequest();
        await request("PATCH", "/api/v1/notifications/read-all");
    } catch (error) {
        console.error("Error marking all notifications as read:", error);
        throw error;
    }
};

// Delete a specific notification
export const deleteNotification = async (notificationId: string): Promise<void> => {
    try {
        const { request } = useRequest();
        await request("DELETE", `/api/v1/notifications/${notificationId}`);
    } catch (error) {
        console.error("Error deleting notification:", error);
        throw error;
    }
};
