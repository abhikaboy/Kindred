import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Subscription } from '@/api/types';
import { getSubscriptionBadge, getTierColor, formatTierName } from '@/utils/subscription';

interface SubscriptionBadgeProps {
    subscription: Subscription;
    style?: any;
}

/**
 * A badge component that displays the user's subscription tier
 * Shows nothing for free users
 */
export default function SubscriptionBadge({ subscription, style }: SubscriptionBadgeProps) {
    const badgeText = getSubscriptionBadge(subscription);
    
    // Don't show badge for free tier
    if (!badgeText) return null;

    const tierColor = getTierColor(subscription.tier);

    return (
        <View style={[styles.badge, { backgroundColor: tierColor + '20', borderColor: tierColor }, style]}>
            <ThemedText style={[styles.badgeText, { color: tierColor }]}>
                {badgeText}
            </ThemedText>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        alignSelf: 'flex-start',
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '600',
    },
});

