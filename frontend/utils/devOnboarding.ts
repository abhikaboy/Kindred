import AsyncStorage from "@react-native-async-storage/async-storage";
import { GUEST_INSTALL_KEY, HAS_EVER_SIGNED_IN_KEY, guestTutorialDoneKey } from "@/constants/authStorageKeys";

// Dev-only harness for the onboarding v2 flow. Mutating helpers are no-ops outside
// __DEV__. Key builders and step validation are pure and always available.

export const homeTourSeenKey = (userId: string) => `${userId}-home-tour-seen`;
export const introTourSeenKey = (userId: string) => `${userId}-intro-tour-seen`;
export const quickSetupKey = (userId: string) => `${userId}-quicksetup`;
/** Persisted v2 step index, so the flow resumes if the app is killed mid-step. */
export const onboardingV2StepKey = (userId: string) => `${userId}-onboarding-v2-step`;

/** Every per-user onboarding key for a user, in one list. */
export const onboardingKeysFor = (userId: string): string[] => [
    homeTourSeenKey(userId),
    introTourSeenKey(userId),
    quickSetupKey(userId),
    guestTutorialDoneKey(userId),
    onboardingV2StepKey(userId),
];

/** Suffixes used to find onboarding keys for every user when no userId is given. */
const ONBOARDING_KEY_SUFFIXES = ["-home-tour-seen", "-intro-tour-seen", "-quicksetup", "-guest-tutorial-done", "-onboarding-v2-step"];

/** Step labels from docs/onboarding-v2-plan.md section 3. Index = step. */
export const ONBOARDING_V2_STEP_LABELS = [
    "Land on Home",
    "Open Kindred Guide",
    "Create a category",
    "Create a task",
    "Back to Home",
    "Explain rings",
    "Quick add",
    "You're set",
    "Guest account prompt",
] as const;

export const ONBOARDING_V2_FIRST_STEP = 0;
export const ONBOARDING_V2_LAST_STEP = ONBOARDING_V2_STEP_LABELS.length - 1;

export const isValidOnboardingV2Step = (step: unknown): step is number =>
    typeof step === "number" && Number.isInteger(step) && step >= ONBOARDING_V2_FIRST_STEP && step <= ONBOARDING_V2_LAST_STEP;

export type OnboardingDebugSnapshot = {
    userId: string | null;
    /** Per-user flags are null when no userId was given. */
    homeTourSeen: boolean | null;
    introTourSeen: boolean | null;
    quickSetupDone: boolean | null;
    guestTutorialDone: boolean | null;
    onboardingV2Step: number | null;
    hasEverSignedIn: boolean;
    guestInstall: boolean;
};

/** Clears onboarding keys for one user, or for every user when userId is omitted. */
export async function resetOnboardingState(userId?: string): Promise<void> {
    if (!__DEV__) return;
    if (userId) {
        await AsyncStorage.multiRemove(onboardingKeysFor(userId));
        return;
    }
    const keys = await AsyncStorage.getAllKeys();
    const toRemove = keys.filter((k) => ONBOARDING_KEY_SUFFIXES.some((s) => k.endsWith(s)));
    if (toRemove.length) await AsyncStorage.multiRemove(toRemove);
}

/** Writes the v2 step index. Returns false (and writes nothing) for an invalid step. */
export async function setOnboardingV2Step(userId: string, step: number): Promise<boolean> {
    if (!__DEV__ || !isValidOnboardingV2Step(step)) return false;
    await AsyncStorage.setItem(onboardingV2StepKey(userId), String(step));
    return true;
}

export async function getOnboardingDebugSnapshot(userId?: string): Promise<OnboardingDebugSnapshot | null> {
    if (!__DEV__) return null;
    const [hasEverSignedIn, guestInstall] = await AsyncStorage.multiGet([HAS_EVER_SIGNED_IN_KEY, GUEST_INSTALL_KEY]).then(
        (pairs) => pairs.map(([, v]) => v === "true")
    );
    const snapshot: OnboardingDebugSnapshot = {
        userId: userId ?? null,
        homeTourSeen: null,
        introTourSeen: null,
        quickSetupDone: null,
        guestTutorialDone: null,
        onboardingV2Step: null,
        hasEverSignedIn,
        guestInstall,
    };
    if (!userId) return snapshot;

    const pairs = await AsyncStorage.multiGet(onboardingKeysFor(userId));
    const value = (key: string) => pairs.find(([k]) => k === key)?.[1] ?? null;
    const rawStep = value(onboardingV2StepKey(userId));
    const step = rawStep === null ? NaN : Number(rawStep);
    return {
        ...snapshot,
        homeTourSeen: value(homeTourSeenKey(userId)) === "true",
        introTourSeen: value(introTourSeenKey(userId)) === "true",
        quickSetupDone: value(quickSetupKey(userId)) === "true",
        guestTutorialDone: value(guestTutorialDoneKey(userId)) === "true",
        onboardingV2Step: isValidOnboardingV2Step(step) ? step : null,
    };
}
