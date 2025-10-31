import { client } from "@/hooks/useTypedAPI";
import type { components } from "./generated/types";
import { withAuthHeaders } from "./utils";
import { useRequest } from "@/hooks/useRequest";

// TODO: Regenerate OpenAPI types after backend updates
// For now, define types manually until we run the schema generator
type SafeUser = components["schemas"]["SafeUser"];

// Define referral types manually (will be replaced with generated types)
export interface ReferralDocument {
  id: string;
  userId: string;
  referralCode: string;
  unlocksRemaining: number;
  referredUsers: ReferredUserInfo[];
  unlockedFeatures: UnlockedFeature[];
  referredBy?: string;
  metadata: ReferralMetadata;
}

export interface ReferredUserInfo {
  userId: string;
  joinedAt: string;
  displayName: string;
  handle: string;
  rewardGranted: boolean;
}

export interface UnlockedFeature {
  featureId: string;
  featureName: string;
  unlockedAt: string;
  unlockedBy: string;
  expiresAt?: string;
  active: boolean;
}

export interface ReferralMetadata {
  createdAt: string;
  updatedAt: string;
  totalReferred: number;
  lastReferralAt?: string;
}

export interface FeatureDefinition {
  id: string;
  name: string;
  description: string;
  icon?: string;
  requiredReferrals: number;
}

export interface ApplyReferralCodeOutputBody {
  success: boolean;
  message: string;
  referrer?: SafeUser;
}

export interface UnlockFeatureOutputBody {
  success: boolean;
  feature: UnlockedFeature;
  unlocksRemaining: number;
}

export interface ReferralStatsOutputBody {
  totalReferrals: number;
  activeReferrals: number;
  unlocksRemaining: number;
  unlockedFeatures: UnlockedFeature[];
  referredUsers: ReferredUserInfo[];
}

export interface AvailableFeaturesOutputBody {
  features: FeatureDefinition[];
}

/**
 * Get the current user's referral information
 * @description Retrieve the user's referral code, unlocks, and referred users
 * @returns Promise with referral document
 * @throws {Error} When the request fails or user is not authenticated
 */
export const getReferralInfo = async (): Promise<ReferralDocument> => {
  try {
    const { request } = useRequest();
    const response = await request("GET", "/user/referrals");
    return response;
  } catch (error) {
    console.error("Error fetching referral info:", error);
    throw new Error("Failed to fetch referral information. Please try again later.");
  }
};

/**
 * Apply a referral code to the current user's account
 * @description Link a referrer to the user's account (only works once)
 * @param code - The referral code to apply
 * @returns Promise with success status and referrer information
 * @throws {Error} When the code is invalid or already applied
 */
export const applyReferralCode = async (code: string): Promise<ApplyReferralCodeOutputBody> => {
  try {
    const { request } = useRequest();
    const response = await request("POST", "/user/referrals/apply", {
      referralCode: code.toUpperCase().trim()
    });
    return response;
  } catch (error: any) {
    console.error("Error applying referral code:", error);
    
    // Handle specific error messages
    if (error.message?.includes("already has a referrer")) {
      throw new Error("You've already used a referral code");
    } else if (error.message?.includes("invalid referral code")) {
      throw new Error("Invalid referral code. Please check and try again");
    } else if (error.message?.includes("cannot refer yourself")) {
      throw new Error("You cannot use your own referral code");
    }
    
    throw new Error("Failed to apply referral code. Please try again later.");
  }
};

/**
 * Unlock a premium feature using referral credits
 * @description Use an available unlock to activate a feature
 * @param featureId - The ID of the feature to unlock
 * @returns Promise with unlocked feature details
 * @throws {Error} When no unlocks are available or feature is invalid
 */
export const unlockFeature = async (featureId: string): Promise<UnlockFeatureOutputBody> => {
  try {
    const { request } = useRequest();
    const response = await request("POST", "/user/referrals/unlock", {
      featureId
    });
    return response;
  } catch (error) {
    console.error("Error unlocking feature:", error);
    throw new Error("Failed to unlock feature. Please try again later.");
  }
};

/**
 * Get detailed referral statistics for the current user
 * @description Retrieve comprehensive stats about referrals and unlocked features
 * @returns Promise with referral statistics
 * @throws {Error} When the request fails or user is not authenticated
 */
export const getReferralStats = async (): Promise<ReferralStatsOutputBody> => {
  try {
    const { request } = useRequest();
    const response = await request("GET", "/user/referrals/stats");
    return response;
  } catch (error) {
    console.error("Error fetching referral stats:", error);
    throw new Error("Failed to fetch referral statistics. Please try again later.");
  }
};

/**
 * Get all available features that can be unlocked through referrals
 * @description Public endpoint that returns the feature catalog
 * @returns Promise with available features list
 * @throws {Error} When the request fails
 */
export const getAvailableFeatures = async (): Promise<AvailableFeaturesOutputBody> => {
  try {
    const { request } = useRequest();
    const response = await request("GET", "/referrals/features");
    return response;
  } catch (error) {
    console.error("Error fetching available features:", error);
    throw new Error("Failed to fetch available features. Please try again later.");
  }
};
