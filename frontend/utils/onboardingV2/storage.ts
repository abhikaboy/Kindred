import AsyncStorage from "@react-native-async-storage/async-storage";
import { onboardingV2StepKey } from "@/utils/devOnboarding";
import { isOnboardingV2Step, OnboardingV2Step, ONBOARDING_V2_DONE } from "@/utils/onboardingV2/machine";

/** Returns the stored step, or null when absent or not a valid step. */
export async function loadStep(userId: string): Promise<OnboardingV2Step | null> {
    const raw = await AsyncStorage.getItem(onboardingV2StepKey(userId));
    if (raw === null || !/^[0-9]$/.test(raw)) return null;
    const step = Number(raw);
    return isOnboardingV2Step(step) ? step : null;
}

export async function saveStep(userId: string, step: OnboardingV2Step): Promise<void> {
    await AsyncStorage.setItem(onboardingV2StepKey(userId), String(step));
}

export async function clearStep(userId: string): Promise<void> {
    await AsyncStorage.removeItem(onboardingV2StepKey(userId));
}

async function hasStoredValue(userId: string): Promise<boolean> {
    return (await AsyncStorage.getItem(onboardingV2StepKey(userId))) !== null;
}

/**
 * Starts the flow only for a brand-new user: no stored step, no real (non-blueprint)
 * workspaces, and no home tour flag. Reads storage, so it is async.
 */
export async function shouldStartOnboardingV2(input: {
    userId: string;
    hasNoWorkspaces: boolean;
    hasHomeTourSeen: boolean;
}): Promise<boolean> {
    if (input.hasHomeTourSeen || !input.hasNoWorkspaces) return false;
    return !(await hasStoredValue(input.userId));
}

/** Existing users with the home tour flag get `done`, so the coach never shows for them. */
export async function migrateExistingUser(userId: string, hasHomeTourSeen: boolean): Promise<void> {
    if (!hasHomeTourSeen || (await hasStoredValue(userId))) return;
    await saveStep(userId, ONBOARDING_V2_DONE);
}
