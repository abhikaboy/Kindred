import { ONBOARDING_V2_DONE } from "@/utils/onboardingV2/machine";

/** True while v2 is running or still loading, so chrome like the tab bar never flashes in first. */
export function isOnboardingV2Active(step: number | null, isLoading: boolean): boolean {
    return isLoading || (step !== null && step !== ONBOARDING_V2_DONE);
}
