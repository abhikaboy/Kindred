import { Subscription, SubscriptionFeatures, SubscriptionTier } from '@/api/types';

/**
 * Check if a subscription is currently active
 */
export function isSubscriptionActive(subscription: Subscription): boolean {
    if (!subscription) return false;
    
    if (subscription.status !== 'active' && 
        subscription.status !== 'trial' && 
        subscription.status !== 'canceled') {
        return false;
    }

    // Check if subscription has expired
    if (subscription.endDate) {
        const endDate = new Date(subscription.endDate);
        if (new Date() > endDate) {
            return false;
        }
    }

    return true;
}

/**
 * Check if subscription is Premium or Lifetime tier
 */
export function isPremiumTier(subscription: Subscription): boolean {
    if (!subscription) return false;
    return subscription.tier === 'premium' || subscription.tier === 'lifetime';
}

/**
 * Check if user has unlimited credits (Premium/Lifetime active)
 */
export function hasUnlimitedCredits(subscription: Subscription): boolean {
    return isSubscriptionActive(subscription) && isPremiumTier(subscription);
}

/**
 * Get the credit multiplier for a subscription
 * @returns 0 for unlimited, 1 for normal, 2 for 2x
 */
export function getCreditMultiplier(subscription: Subscription): number {
    if (!isSubscriptionActive(subscription)) {
        return 1.0;
    }

    switch (subscription.tier) {
        case 'basic':
            return 2.0;
        case 'premium':
        case 'lifetime':
            return 0.0; // 0 indicates unlimited
        default:
            return 1.0;
    }
}

/**
 * Get features available for a subscription
 */
export function getSubscriptionFeatures(subscription: Subscription | null): SubscriptionFeatures {
    if (!subscription || !isSubscriptionActive(subscription)) {
        return {
            unlimitedVoice: false,
            unlimitedNaturalLanguage: false,
            unlimitedGroups: false,
            unlimitedAnalytics: false,
            noAds: false,
            prioritySupport: false,
            creditMultiplier: 1.0,
        };
    }

    switch (subscription.tier) {
        case 'basic':
            return {
                unlimitedVoice: false,
                unlimitedNaturalLanguage: false,
                unlimitedGroups: false,
                unlimitedAnalytics: false,
                noAds: true,
                prioritySupport: false,
                creditMultiplier: 2.0,
            };
        case 'premium':
        case 'lifetime':
            return {
                unlimitedVoice: true,
                unlimitedNaturalLanguage: true,
                unlimitedGroups: true,
                unlimitedAnalytics: true,
                noAds: true,
                prioritySupport: true,
                creditMultiplier: 0.0, // Unlimited
            };
        default: // free
            return {
                unlimitedVoice: false,
                unlimitedNaturalLanguage: false,
                unlimitedGroups: false,
                unlimitedAnalytics: false,
                noAds: false,
                prioritySupport: false,
                creditMultiplier: 1.0,
            };
    }
}

/**
 * Format subscription tier for display
 */
export function formatTierName(tier: SubscriptionTier): string {
    switch (tier) {
        case 'free':
            return 'Free';
        case 'basic':
            return 'Basic';
        case 'premium':
            return 'Premium';
        case 'lifetime':
            return 'Lifetime';
        default:
            return 'Free';
    }
}

/**
 * Get tier color for UI elements
 */
export function getTierColor(tier: SubscriptionTier): string {
    switch (tier) {
        case 'basic':
            return '#3B82F6'; // Blue
        case 'premium':
            return '#8B5CF6'; // Purple
        case 'lifetime':
            return '#F59E0B'; // Gold
        default:
            return '#6B7280'; // Gray
    }
}

/**
 * Get price string for a tier
 */
export function getTierPrice(tier: SubscriptionTier): string {
    switch (tier) {
        case 'free':
            return '$0';
        case 'basic':
            return '$4.99/mo';
        case 'premium':
            return '$9.99/mo';
        case 'lifetime':
            return '$49.99';
        default:
            return '$0';
    }
}

/**
 * Check if user can use a specific feature
 */
export function canUseFeature(
    subscription: Subscription | null,
    feature: keyof SubscriptionFeatures
): boolean {
    const features = getSubscriptionFeatures(subscription);
    return features[feature] as boolean;
}

/**
 * Get days until subscription renews or expires
 */
export function getDaysUntilRenewal(subscription: Subscription): number | null {
    if (!subscription) return null;
    
    const targetDate = subscription.renewalDate || subscription.endDate;
    if (!targetDate) return null;

    const now = new Date();
    const target = new Date(targetDate);
    const diffTime = target.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
}

/**
 * Format renewal/expiration date for display
 */
export function formatRenewalDate(subscription: Subscription): string {
    const days = getDaysUntilRenewal(subscription);
    
    if (days === null) return '';
    if (days < 0) return 'Expired';
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days <= 7) return `In ${days} days`;
    
    const date = new Date(subscription.renewalDate || subscription.endDate!);
    return date.toLocaleDateString();
}

/**
 * Check if subscription is in grace period (canceled but still active)
 */
export function isInGracePeriod(subscription: Subscription): boolean {
    if (!subscription) return false;
    return subscription.status === 'canceled' && isSubscriptionActive(subscription);
}

/**
 * Get appropriate upgrade message based on current tier
 */
export function getUpgradeMessage(subscription: Subscription | null): string {
    if (!subscription || subscription.tier === 'free') {
        return 'Upgrade to Premium for unlimited access!';
    }
    if (subscription.tier === 'basic') {
        return 'Upgrade to Premium for unlimited everything!';
    }
    return 'You have the best plan!';
}

/**
 * Get subscription badge text
 */
export function getSubscriptionBadge(subscription: Subscription | null): string | null {
    if (!subscription || subscription.tier === 'free') return null;
    
    if (subscription.tier === 'lifetime') return '👑 Lifetime';
    if (subscription.tier === 'premium') return '⭐ Premium';
    if (subscription.tier === 'basic') return '✨ Basic';
    
    return null;
}

