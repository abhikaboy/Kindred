import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/hooks/useAuth";
import { useIsGuest } from "@/hooks/useIsGuest";
import {
    OnboardingV2Event,
    OnboardingV2State,
    OnboardingV2Step,
    ONBOARDING_V2_DONE,
    reduce,
} from "@/utils/onboardingV2/machine";
import { loadStep, migrateExistingUser, saveStep, shouldStartOnboardingV2 } from "@/utils/onboardingV2/storage";
import { guestTutorialDoneKey } from "@/constants/authStorageKeys";
import { quickSetupKey } from "@/utils/devOnboarding";

type Options = {
    /** True when the user has no real (non-blueprint) workspaces. Read from the workspace list by the caller. */
    hasNoWorkspaces: boolean;
    /** Set once the workspace list has loaded, so a new user isn't misread as having no workspaces. */
    ready: boolean;
};

/** Single source of truth for the v2 coach. `step` is null until the stored step has loaded. */
export function useOnboardingV2({ hasNoWorkspaces, ready }: Options) {
    const { user } = useAuth();
    const isGuest = useIsGuest();
    const userId = user?._id ?? null;

    const [state, setState] = useState<OnboardingV2State | null>(null);
    const stateRef = useRef<OnboardingV2State | null>(null);

    useEffect(() => {
        if (!userId || !ready || stateRef.current) return;
        let cancelled = false;
        (async () => {
            let next: OnboardingV2State;
            try {
                const stored = await loadStep(userId);
                const hasHomeTourSeen = await migrateStoredFlag(userId);
                let step: OnboardingV2Step = stored ?? ONBOARDING_V2_DONE;
                if (stored === null) {
                    const start = await shouldStartOnboardingV2({ userId, hasNoWorkspaces, hasHomeTourSeen });
                    step = start ? 0 : ONBOARDING_V2_DONE;
                    await saveStep(userId, step);
                } else if (step === ONBOARDING_V2_DONE && isGuest) {
                    // Guests who skipped before the flag was written still need it, or prompts stay dead.
                    await AsyncStorage.setItem(guestTutorialDoneKey(userId), "true");
                }
                next = { step, isGuest };
            } catch (error) {
                console.warn("Onboarding v2: could not load the step, hiding the coach", error);
                next = { step: ONBOARDING_V2_DONE, isGuest };
            }
            if (cancelled) return;
            stateRef.current = next;
            setState(next);
        })();
        return () => {
            cancelled = true;
        };
    }, [userId, ready, hasNoWorkspaces, isGuest]);

    const dispatch = useCallback(
        (event: OnboardingV2Event) => {
            const current = stateRef.current;
            if (!current || !userId) return;
            const next = reduce(current, event);
            if (next === current) return;
            stateRef.current = next;
            if (next.step === ONBOARDING_V2_DONE) {
                // Flags are written before the UI flips, so Home never reads quick-setup too early.
                void persistDone(userId, next.isGuest).then(() => setState(next));
                return;
            }
            setState(next);
            saveStep(userId, next.step).catch(() => {});
        },
        [userId],
    );

    return {
        step: state?.step ?? null,
        state,
        isGuest,
        dispatch,
        isLoading: state === null,
    };
}

/**
 * Writes the terminal step, the quick-setup flag (so the sheet stays away) and,
 * for guests, the flag that unlocks account prompts. Never rejects.
 */
async function persistDone(userId: string, isGuest: boolean): Promise<void> {
    const writes: Promise<unknown>[] = [saveStep(userId, ONBOARDING_V2_DONE), AsyncStorage.setItem(quickSetupKey(userId), "true")];
    if (isGuest) writes.push(AsyncStorage.setItem(guestTutorialDoneKey(userId), "true"));
    const results = await Promise.allSettled(writes);
    for (const result of results) {
        if (result.status === "rejected") console.warn("Onboarding v2: could not persist done", result.reason);
    }
}

/** Reads the home-tour flag so existing users are marked done before the start rule runs. */
async function migrateStoredFlag(userId: string): Promise<boolean> {
    const seen = (await AsyncStorage.getItem(`${userId}-home-tour-seen`)) === "true";
    await migrateExistingUser(userId, seen);
    return seen;
}
