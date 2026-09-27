import { getNotificationRefreshPlan } from "@/utils/notificationInvalidation";

describe("getNotificationRefreshPlan", () => {
    it("refreshes kudos for kudos pushes without touching workspaces", () => {
        const plan = getNotificationRefreshPlan("encouragement");
        expect(plan).toMatchObject({ all: false, kudos: true, workspaces: false });
    });

    it("refreshes workspaces for task pushes", () => {
        expect(getNotificationRefreshPlan("task_tagged")).toMatchObject({ all: false, workspaces: true });
    });

    it("targets friend queries for friend requests", () => {
        const plan = getNotificationRefreshPlan("friend_request");
        expect(plan.all).toBe(false);
        expect(plan.queryRoots).toEqual(expect.arrayContaining(["connections", "friends"]));
    });

    it("does nothing for reminders", () => {
        expect(getNotificationRefreshPlan("ABSOLUTE")).toEqual({ all: false, queryRoots: [], kudos: false, workspaces: false });
    });

    it("falls back to refreshing everything for unknown or missing types", () => {
        expect(getNotificationRefreshPlan("brand_new_type")).toMatchObject({ all: true });
        expect(getNotificationRefreshPlan(undefined)).toMatchObject({ all: true });
    });
});
