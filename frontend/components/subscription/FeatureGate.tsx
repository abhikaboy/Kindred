import React from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Subscription, SubscriptionFeatures } from '@/api/types';
import { canUseFeature, getUpgradeMessage, hasUnlimitedCredits } from '@/utils/subscription';
import { useThemeColor } from '@/hooks/useThemeColor';

interface FeatureGateProps {
    subscription: Subscription | null;
    credits?: number;
    feature?: keyof SubscriptionFeatures;
    children: React.ReactNode;
    onUpgradePress?: () => void;
}

/**
 * A component that gates access to features based on subscription tier
 * and available credits. Shows upgrade prompt when feature is unavailable.
 * 
 * @example
 * <FeatureGate 
 *   subscription={user.subscription} 
 *   credits={user.credits.voice}
 *   feature="unlimitedVoice"
 *   onUpgradePress={() => router.push('/upgrade')}
 * >
 *   <VoiceRecordButton />
 * </FeatureGate>
 */
export default function FeatureGate({ 
    subscription, 
    credits = 0,
    feature,
    children, 
    onUpgradePress 
}: FeatureGateProps) {
    const ThemedColor = useThemeColor();
    
    // Check if user has unlimited access via subscription
    const isUnlimited = hasUnlimitedCredits(subscription);
    
    // Check if user has specific feature unlocked
    const hasFeature = feature ? canUseFeature(subscription, feature) : false;
    
    // User can access if:
    // 1. They have unlimited credits (Premium/Lifetime)
    // 2. They have the specific feature unlocked
    // 3. They have credits remaining
    const canAccess = isUnlimited || hasFeature || credits > 0;

    if (canAccess) {
        return <>{children}</>;
    }

    // Show locked state
    return (
        <View style={styles.lockedContainer}>
            <View style={styles.lockedOverlay}>
                <ThemedText type="defaultSemiBold" style={styles.lockedTitle}>
                    Feature Locked
                </ThemedText>
                <ThemedText style={styles.lockedDescription}>
                    {getUpgradeMessage(subscription)}
                </ThemedText>
                {onUpgradePress && (
                    <TouchableOpacity
                        style={[styles.upgradeButton, { backgroundColor: ThemedColor.primary }]}
                        onPress={onUpgradePress}
                    >
                        <ThemedText style={[styles.upgradeButtonText, { color: ThemedColor.buttonText }]}>
                            Upgrade Now
                        </ThemedText>
                    </TouchableOpacity>
                )}
            </View>
            <View style={styles.blurredContent}>
                {children}
            </View>
        </View>
    );
}

/**
 * Hook to check if a feature is available
 * @example
 * const canUseVoice = useFeatureAccess(user.subscription, user.credits.voice, 'unlimitedVoice');
 */
export function useFeatureAccess(
    subscription: Subscription | null,
    credits: number = 0,
    feature?: keyof SubscriptionFeatures
): boolean {
    const isUnlimited = hasUnlimitedCredits(subscription);
    const hasFeature = feature ? canUseFeature(subscription, feature) : false;
    
    return isUnlimited || hasFeature || credits > 0;
}

const styles = StyleSheet.create({
    lockedContainer: {
        position: 'relative',
        width: '100%',
    },
    lockedOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        zIndex: 10,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        borderRadius: 12,
    },
    blurredContent: {
        opacity: 0.3,
        pointerEvents: 'none',
    },
    lockedTitle: {
        fontSize: 18,
        marginBottom: 8,
        color: '#ffffff',
    },
    lockedDescription: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 16,
        color: '#ffffff',
        opacity: 0.9,
    },
    upgradeButton: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    upgradeButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
});

