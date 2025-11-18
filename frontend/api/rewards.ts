import client from "./client";
import { withAuthHeaders } from "./utils";

export type RewardType = "voice" | "naturalLanguage" | "group" | "integration" | "analytics";
export type KudosType = "encouragements" | "congratulations";

export interface RedeemRewardRequest {
    rewardType: RewardType;
    kudosType: KudosType;
}

export interface RedeemRewardResponse {
    message: string;
    kudosRemaining: number;
    creditsReceived?: number;
}

/**
 * Redeem a kudos reward
 * API: Makes POST request to redeem a reward using accumulated kudos
 * Frontend: Called when user claims a reward from the kudos rewards page
 * @param rewardType - The type of reward to redeem
 * @param kudosType - The type of kudos to use (encouragements or congratulations)
 */
export const redeemRewardAPI = async (rewardType: RewardType, kudosType: KudosType): Promise<RedeemRewardResponse> => {
    const { data, error } = await client.POST("/v1/user/rewards/redeem" as any, {
        params: withAuthHeaders(),
        body: { rewardType, kudosType } as any,
    });

    if (error) {
        throw new Error(`Failed to redeem reward: ${JSON.stringify(error)}`);
    }

    return data as RedeemRewardResponse;
};

