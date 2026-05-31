import { useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getNotifications, markNotificationsAsRead, markAllNotificationsAsRead } from '@/api/notifications';
import type { components } from '@/api/generated/types';
import { showToast } from '@/utils/showToast';

type NotificationDocument = components["schemas"]["NotificationDocument"];

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

    // Exponential backoff up to ~30s, capped at 3 retries. Mutations default to no retries.
    const retryDelay = (attempt: number) => Math.min(1000 * 2 ** attempt, 30_000);

    // Mutation for marking notifications as read
    const markAsReadMutation = useMutation({
        mutationFn: markNotificationsAsRead,
        retry: 3,
        retryDelay,
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
        retry: 3,
        retryDelay,
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
        },
        onError: (err) => {
            // Only fires after retries are exhausted; surface to the user once.
            console.error('Failed to mark all notifications as read:', err);
            showToast('Failed to mark all notifications as read', 'danger');
        },
    });

    const notifications = notificationsData?.notifications || [];
    const unreadCount = notificationsData?.unread_count || 0;
    const error = queryError ? 'Failed to load notifications' : null;

    // `mutate` is stable across renders; capture it in refs so the wrappers we
    // return don't change identity each render (otherwise consumers that depend
    // on these in effects re-fire constantly).
    const markAsReadMutateRef = useRef(markAsReadMutation.mutate);
    markAsReadMutateRef.current = markAsReadMutation.mutate;
    const markAllAsReadMutateRef = useRef(markAllAsReadMutation.mutate);
    markAllAsReadMutateRef.current = markAllAsReadMutation.mutate;

    const markAsRead = useCallback((notificationIds: string[]) => {
        markAsReadMutateRef.current(notificationIds);
    }, []);

    const markAllAsRead = useCallback(() => {
        markAllAsReadMutateRef.current();
    }, []);

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
