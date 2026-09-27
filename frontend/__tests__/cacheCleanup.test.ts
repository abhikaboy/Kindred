jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import { cleanupOldCaches } from "@/utils/cacheCleanup";

const DAY = 24 * 60 * 60 * 1000;

describe("cleanupOldCaches", () => {
    beforeEach(async () => {
        await AsyncStorage.clear();
        jest.clearAllMocks();
    });

    it("removes stale entries, keeps fresh ones, and never reads skipped keys", async () => {
        await AsyncStorage.multiSet([
            ["workspaces_cache_old", JSON.stringify({ data: [], timestamp: Date.now() - 10 * DAY })],
            ["workspaces_cache_fresh", JSON.stringify({ data: [], timestamp: Date.now() })],
            ["workspaces_cache_me", JSON.stringify({ data: [], timestamp: Date.now() - 10 * DAY })],
            ["unrelated", "x"],
        ]);

        const removed = await cleanupOldCaches(7 * DAY, ["workspaces_cache_"], ["workspaces_cache_me"]);

        expect(removed).toBe(1);
        const keys = await AsyncStorage.getAllKeys();
        expect(keys).toEqual(expect.arrayContaining(["workspaces_cache_fresh", "workspaces_cache_me", "unrelated"]));
        expect(keys).not.toContain("workspaces_cache_old");
        const read = (AsyncStorage.multiGet as jest.Mock).mock.calls.flatMap((c) => c[0]);
        expect(read).not.toContain("workspaces_cache_me");
        expect(AsyncStorage.getItem).not.toHaveBeenCalled();
    });
});
