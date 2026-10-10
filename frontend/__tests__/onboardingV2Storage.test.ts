jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    clearStep,
    loadStep,
    migrateExistingUser,
    saveStep,
    shouldStartOnboardingV2,
} from "@/utils/onboardingV2/storage";

const KEY = "u1-onboarding-v2-step";

describe("onboarding v2 storage", () => {
    beforeEach(() => AsyncStorage.clear());

    it("round-trips a saved step under the per-user key", async () => {
        await saveStep("u1", 4);
        expect(await AsyncStorage.getItem(KEY)).toBe("4");
        expect(await loadStep("u1")).toBe(4);
    });

    it("keeps steps separate per user", async () => {
        await saveStep("u1", 2);
        expect(await loadStep("u2")).toBeNull();
    });

    it("returns null when absent", async () => {
        expect(await loadStep("u1")).toBeNull();
    });

    it.each(["", " ", "10", "-1", "1.5", "abc", "3 ", "NaN", "true"])("returns null for invalid stored value %j", async (raw) => {
        await AsyncStorage.setItem(KEY, raw);
        expect(await loadStep("u1")).toBeNull();
    });

    it("accepts the boundary values 0 and 9", async () => {
        await AsyncStorage.setItem(KEY, "0");
        expect(await loadStep("u1")).toBe(0);
        await AsyncStorage.setItem(KEY, "9");
        expect(await loadStep("u1")).toBe(9);
    });

    it("clears the stored step", async () => {
        await saveStep("u1", 7);
        await clearStep("u1");
        expect(await loadStep("u1")).toBeNull();
    });

    describe("shouldStartOnboardingV2", () => {
        const base = { userId: "u1", hasNoWorkspaces: true, hasHomeTourSeen: false };

        it("starts for a new user with no workspaces and no home tour flag", async () => {
            expect(await shouldStartOnboardingV2(base)).toBe(true);
        });

        it("does not start when a step is already stored, even an invalid one", async () => {
            await saveStep("u1", 3);
            expect(await shouldStartOnboardingV2(base)).toBe(false);
            await AsyncStorage.clear();
            await AsyncStorage.setItem(KEY, "garbage");
            expect(await shouldStartOnboardingV2(base)).toBe(false);
        });

        it("does not start when the user has real workspaces", async () => {
            expect(await shouldStartOnboardingV2({ ...base, hasNoWorkspaces: false })).toBe(false);
        });

        it("does not start when the home tour was seen", async () => {
            expect(await shouldStartOnboardingV2({ ...base, hasHomeTourSeen: true })).toBe(false);
        });
    });

    describe("migrateExistingUser", () => {
        it("writes done for a user with the home tour flag and no v2 key", async () => {
            await migrateExistingUser("u1", true);
            expect(await loadStep("u1")).toBe(9);
        });

        it("writes nothing without the home tour flag", async () => {
            await migrateExistingUser("u1", false);
            expect(await AsyncStorage.getItem(KEY)).toBeNull();
        });

        it("does not overwrite an existing v2 key", async () => {
            await saveStep("u1", 2);
            await migrateExistingUser("u1", true);
            expect(await loadStep("u1")).toBe(2);
        });

        it("does not overwrite an invalid existing v2 value", async () => {
            await AsyncStorage.setItem(KEY, "bogus");
            await migrateExistingUser("u1", true);
            expect(await AsyncStorage.getItem(KEY)).toBe("bogus");
        });
    });
});
