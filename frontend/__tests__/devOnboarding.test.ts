jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import {
    homeTourSeenKey,
    introTourSeenKey,
    isValidOnboardingV2Step,
    ONBOARDING_V2_LAST_STEP,
    ONBOARDING_V2_STEP_LABELS,
    onboardingKeysFor,
    onboardingV2StepKey,
    quickSetupKey,
} from "@/utils/devOnboarding";

describe("devOnboarding keys", () => {
    it("builds per-user keys with the literal suffixes the app already uses", () => {
        expect(homeTourSeenKey("u1")).toBe("u1-home-tour-seen");
        expect(introTourSeenKey("u1")).toBe("u1-intro-tour-seen");
        expect(quickSetupKey("u1")).toBe("u1-quicksetup");
        expect(onboardingV2StepKey("u1")).toBe("u1-onboarding-v2-step");
    });

    it("lists every onboarding key for a user, including the guest tutorial flag", () => {
        expect(onboardingKeysFor("u1")).toEqual([
            "u1-home-tour-seen",
            "u1-intro-tour-seen",
            "u1-quicksetup",
            "u1-guest-tutorial-done",
            "u1-onboarding-v2-step",
        ]);
    });
});

describe("isValidOnboardingV2Step", () => {
    it("accepts every planned step from 0 to 8", () => {
        expect(ONBOARDING_V2_STEP_LABELS).toHaveLength(9);
        expect(ONBOARDING_V2_LAST_STEP).toBe(8);
        for (let step = 0; step <= 8; step++) expect(isValidOnboardingV2Step(step)).toBe(true);
    });

    it("rejects out-of-range, fractional, non-number and NaN values", () => {
        for (const bad of [-1, 9, 1.5, NaN, Infinity, "3", null, undefined]) {
            expect(isValidOnboardingV2Step(bad)).toBe(false);
        }
    });
});
