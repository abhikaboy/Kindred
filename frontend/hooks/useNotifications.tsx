import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getNotifications, markNotificationsAsRead, markAllNotificationsAsRead, NotificationDocument } from '@/api/notifications';
import { showToast } from '@/utils/showToast';

export interface UseNotificationsReturn {
    notifications: NotificationDocument[];
    unreadCount: number;
    loading: boolean;
    error: string | null;
    refreshNotifications: () => void;
    markAsRead: (notificationIds: string[]) => void;
    markAllAsRead: () => void;
}

export const useNotifications = (): UseNotificationsReturn => {
    const queryClient = useQueryClient();

    // Query for fetching notifications
    const {
        data: notificationsData,
        isLoading: loading,
        error: queryError,
        refetch: refreshNotifications,
    } = useQuery({
        queryKey: ['notifications'],
        queryFn: () => getNotifications(50, 0),
        staleTime: 30000, // 30 seconds
        gcTime: 5 * 60 * 1000, // 5 minutes
    });

    // Mutation for marking notifications as read
    const markAsReadMutation = useMutation({
        mutationFn: markNotificationsAsRead,
        onSuccess: (_, notificationIds) => {
            // Optimistically update the cache
            queryClient.setQueryData(['notifications'], (oldData: any) => {
                if (!oldData) return oldData;
                
                return {
                    ...oldData,
                    notifications: oldData.notifications.map((notification: NotificationDocument) =>
                        notificationIds.includes(notification.id)
                            ? { ...notification, read: true }
                            : notification
                    ),
                    unread_count: Math.max(0, oldData.unread_count - notificationIds.length),
                };
            });
        },
        onError: (err) => {
            console.error('Failed to mark notifications as read:', err);
            showToast('Failed to mark notifications as read', 'danger');
        },
    });

    // Mutation for marking all notifications as read
    const markAllAsReadMutation = useMutation({
        mutationFn: markAllNotificationsAsRead,
        onSuccess: () => {
            // Optimistically update the cache
            queryClient.setQueryData(['notifications'], (oldData: any) => {
                if (!oldData) return oldData;
                
                return {
                    ...oldData,
                    notifications: oldData.notifications.map((notification: NotificationDocument) => ({
                        ...notification,
                        read: true,
                    })),
                    unread_count: 0,
                };
            });
            showToast('All notifications marked as read', 'success');
        },
        onError: (err) => {
            console.error('Failed to mark all notifications as read:', err);
            showToast('Failed to mark all notifications as read', 'danger');
        },
    });

    const notifications = notificationsData?.notifications || [];
    const unreadCount = notificationsData?.unread_count || 0;
    const error = queryError ? 'Failed to load notifications' : null;

    const markAsRead = (notificationIds: string[]) => {
        markAsReadMutation.mutate(notificationIds);
    };

    const markAllAsRead = () => {
        markAllAsReadMutation.mutate();
    };

    return {
        notifications,
        unreadCount,
        loading,
        error,
        refreshNotifications,
        markAsRead,
        markAllAsRead,
    };
};
