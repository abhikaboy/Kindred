jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import { enterAsNewGuest, routeForGuest, GUEST_TUTORIAL_ROUTE, TABS_ROUTE } from "@/utils/guestEntry";

describe("guestEntry", () => {
    beforeEach(() => AsyncStorage.clear());

    it("sends a guest to the tutorial until it is done", async () => {
        expect(await routeForGuest("g1")).toBe(GUEST_TUTORIAL_ROUTE);
        await AsyncStorage.setItem("g1-guest-tutorial-done", "true");
        expect(await routeForGuest("g1")).toBe(TABS_ROUTE);
    });

    it("creates a guest and routes it", async () => {
        const start = jest.fn(() => Promise.resolve({ _id: "g2" }));
        expect(await enterAsNewGuest(start)).toBe(GUEST_TUTORIAL_ROUTE);
        expect(start).toHaveBeenCalledTimes(1);
    });

    it("falls back to login when the guest can't be created", async () => {
        const start = jest.fn(() => Promise.reject(new Error("offline")));
        expect(await enterAsNewGuest(start)).toBe("/login");
    });
});
