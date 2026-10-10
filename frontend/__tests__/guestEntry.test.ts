import { enterAsNewGuest, routeForGuest, TABS_ROUTE } from "@/utils/guestEntry";

describe("guestEntry", () => {
    it("sends a new guest to Home", async () => {
        expect(await routeForGuest("g1")).toBe(TABS_ROUTE);
    });

    it("creates a guest and routes it", async () => {
        const start = jest.fn(() => Promise.resolve({ _id: "g2" }));
        expect(await enterAsNewGuest(start)).toBe(TABS_ROUTE);
        expect(start).toHaveBeenCalledTimes(1);
    });

    it("falls back to login when the guest can't be created", async () => {
        const start = jest.fn(() => Promise.reject(new Error("offline")));
        expect(await enterAsNewGuest(start)).toBe("/login");
    });
});
