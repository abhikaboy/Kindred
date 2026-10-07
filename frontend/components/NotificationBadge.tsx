import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNotifications } from '@/hooks/useNotifications';
import { useThemeColor } from '@/hooks/useThemeColor';

interface NotificationBadgeProps {
    showZero?: boolean;
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({ showZero = false }) => {
    const { unreadCount, loading } = useNotifications();
    const themedColor = useThemeColor();

    if (loading || (!showZero && unreadCount === 0)) {
        return null;
    }

    return (
        <View style={[styles.badge, { backgroundColor: themedColor.error }]}>
            <Text style={[styles.badgeText, { color: 'white' }]}>
                {unreadCount > 99 ? '99+' : unreadCount.toString()}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    badge: {
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: 'bold',
        textAlign: 'center',
    },
});

export default NotificationBadge;
