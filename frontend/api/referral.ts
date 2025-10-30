import { client } from "@/hooks/useTypedAPI";
import { withAuthHeaders } from "./utils";

/**
 * Apply a referral code to the current user's account
 * API: Makes POST request to apply referral code
 * Frontend: Used during onboarding to let users enter a referral code
 * @param referralCode - The 8-character referral code
 */
export const applyReferralCode = async (referralCode: string) => {
    try {
        const response = await client.POST("/v1/user/referrals/apply", {
            params: withAuthHeaders(),
            body: {
                referralCode: referralCode.toUpperCase().trim(),
            },
        });

        if (response.error) {
            throw new Error(response.error.detail || "Failed to apply referral code");
        }

        return response.data;
    } catch (error: any) {
        // Handle specific error messages
        if (error.message?.includes("already has a referrer")) {
            throw new Error("You've already used a referral code");
        } else if (error.message?.includes("invalid referral code")) {
            throw new Error("Invalid referral code. Please check and try again");
        } else if (error.message?.includes("cannot refer yourself")) {
            throw new Error("You cannot use your own referral code");
        }
        throw error;
    }
};

/**
 * Get the current user's referral information
 * API: Makes GET request to retrieve referral data
 * Frontend: Used to display user's referral code and stats
 */
export const getReferralInfo = async () => {
    const response = await client.GET("/v1/user/referrals", {
        params: withAuthHeaders(),
    });

    if (response.error) {
        throw new Error("Failed to get referral info");
    }

    return response.data;
};

/**
 * Get referral statistics for the current user
 * API: Makes GET request to retrieve stats
 * Frontend: Used for referral dashboard
 */
export const getReferralStats = async () => {
    const response = await client.GET("/v1/user/referrals/stats", {
        params: withAuthHeaders(),
    });

    if (response.error) {
        throw new Error("Failed to get referral stats");
    }

    return response.data;
};

/**
 * Unlock a feature using referral credits
 * API: Makes POST request to unlock feature
 * Frontend: Used in feature marketplace
 * @param featureId - The ID of the feature to unlock
 */
export const unlockFeature = async (featureId: string) => {
    const response = await client.POST("/v1/user/referrals/unlock", {
        params: withAuthHeaders(),
        body: { featureId },
    });

    if (response.error) {
        throw new Error(response.error.detail || "Failed to unlock feature");
    }

    return response.data;
};

/**
 * Get all available features that can be unlocked
 * API: Makes GET request (public endpoint, no auth)
 * Frontend: Used to display feature catalog
 */
export const getAvailableFeatures = async () => {
    const response = await client.GET("/v1/referrals/features", {});

    if (response.error) {
        throw new Error("Failed to get available features");
    }

    return response.data;
};

