import { isOnboardingV2Active } from "@/utils/onboardingV2/active";

describe("isOnboardingV2Active", () => {
    test("is active while loading so the tab bar never flashes in", () => {
        expect(isOnboardingV2Active(null, true)).toBe(true);
    });
    test.each([0, 4, 8])("is active on step %i", (step) => expect(isOnboardingV2Active(step, false)).toBe(true));
    test("is inactive with no step or when done", () => {
        expect(isOnboardingV2Active(null, false)).toBe(false);
        expect(isOnboardingV2Active(9, false)).toBe(false);
    });
});
