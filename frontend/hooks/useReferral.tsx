import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    getReferralInfo, 
    getReferralStats, 
    applyReferralCode, 
    unlockFeature, 
    getAvailableFeatures,
    type ReferralDocument,
    type ReferralStatsOutputBody,
    type ApplyReferralCodeOutputBody,
    type UnlockFeatureOutputBody,
    type AvailableFeaturesOutputBody,
    type FeatureDefinition
} from '@/api/referral';
import { showToast } from '@/utils/showToast';

export interface UseReferralReturn {
    // Referral info
    referralInfo: ReferralDocument | null;
    referralCode: string | null;
    unlocksRemaining: number;
    
    // Stats
    stats: ReferralStatsOutputBody | null;
    totalReferrals: number;
    activeReferrals: number;
    
    // Available features
    availableFeatures: FeatureDefinition[];
    
    // Loading states
    isLoadingInfo: boolean;
    isLoadingStats: boolean;
    isLoadingFeatures: boolean;
    
    // Error states
    infoError: string | null;
    statsError: string | null;
    featuresError: string | null;
    
    // Mutations
    applyCode: (code: string) => Promise<void>;
    unlock: (featureId: string) => Promise<void>;
    isApplyingCode: boolean;
    isUnlocking: boolean;
    
    // Refresh functions
    refreshInfo: () => void;
    refreshStats: () => void;
}

export const useReferral = (): UseReferralReturn => {
    const queryClient = useQueryClient();

    // Query for fetching referral info
    const {
        data: referralInfoData,
        isLoading: isLoadingInfo,
        error: infoQueryError,
        refetch: refreshInfo,
    } = useQuery({
        queryKey: ['referralInfo'],
        queryFn: getReferralInfo,
        staleTime: 60000, // 1 minute
        gcTime: 5 * 60 * 1000, // 5 minutes
    });

    // Query for fetching referral stats
    const {
        data: statsData,
        isLoading: isLoadingStats,
        error: statsQueryError,
        refetch: refreshStats,
    } = useQuery({
        queryKey: ['referralStats'],
        queryFn: getReferralStats,
        staleTime: 60000, // 1 minute
        gcTime: 5 * 60 * 1000, // 5 minutes
    });

    // Query for fetching available features
    const {
        data: featuresData,
        isLoading: isLoadingFeatures,
        error: featuresQueryError,
    } = useQuery({
        queryKey: ['availableFeatures'],
        queryFn: getAvailableFeatures,
        staleTime: 5 * 60 * 1000, // 5 minutes (features don't change often)
        gcTime: 10 * 60 * 1000, // 10 minutes
    });

    // Mutation for applying referral code
    const applyCodeMutation = useMutation({
        mutationFn: applyReferralCode,
        onSuccess: (data) => {
            // Invalidate and refetch referral info to get updated data
            queryClient.invalidateQueries({ queryKey: ['referralInfo'] });
            queryClient.invalidateQueries({ queryKey: ['referralStats'] });
            
            showToast(
                `Success! You were referred by ${data.referrer?.displayName || 'someone'}!`,
                'success'
            );
        },
        onError: (error: Error) => {
            console.error('Failed to apply referral code:', error);
            showToast(error.message || 'Failed to apply referral code', 'danger');
        },
    });

    // Mutation for unlocking features
    const unlockFeatureMutation = useMutation({
        mutationFn: unlockFeature,
        onSuccess: (data) => {
            // Update the cache optimistically
            queryClient.setQueryData(['referralInfo'], (oldData: ReferralDocument | undefined) => {
                if (!oldData) return oldData;
                
                return {
                    ...oldData,
                    unlocksRemaining: data.unlocksRemaining,
                    unlockedFeatures: [...(oldData.unlockedFeatures || []), data.feature],
                };
            });
            
            // Also invalidate stats
            queryClient.invalidateQueries({ queryKey: ['referralStats'] });
            
            showToast(`Feature "${data.feature.featureName}" unlocked!`, 'success');
        },
        onError: (error: Error) => {
            console.error('Failed to unlock feature:', error);
            showToast(error.message || 'Failed to unlock feature', 'danger');
        },
    });

    // Extract data with defaults
    const referralCode = referralInfoData?.referralCode || null;
    const unlocksRemaining = referralInfoData?.unlocksRemaining || 0;
    const totalReferrals = statsData?.totalReferrals || 0;
    const activeReferrals = statsData?.activeReferrals || 0;
    const availableFeatures = featuresData?.features || [];

    const infoError = infoQueryError ? 'Failed to load referral information' : null;
    const statsError = statsQueryError ? 'Failed to load referral statistics' : null;
    const featuresError = featuresQueryError ? 'Failed to load available features' : null;

    // Wrapper functions for mutations
    const applyCode = async (code: string) => {
        await applyCodeMutation.mutateAsync(code);
    };

    const unlock = async (featureId: string) => {
        await unlockFeatureMutation.mutateAsync(featureId);
    };

    return {
        // Referral info
        referralInfo: referralInfoData || null,
        referralCode,
        unlocksRemaining,
        
        // Stats
        stats: statsData || null,
        totalReferrals,
        activeReferrals,
        
        // Available features
        availableFeatures,
        
        // Loading states
        isLoadingInfo,
        isLoadingStats,
        isLoadingFeatures,
        
        // Error states
        infoError,
        statsError,
        featuresError,
        
        // Mutations
        applyCode,
        unlock,
        isApplyingCode: applyCodeMutation.isPending,
        isUnlocking: unlockFeatureMutation.isPending,
        
        // Refresh functions
        refreshInfo,
        refreshStats,
    };
};

