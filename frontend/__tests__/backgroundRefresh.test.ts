jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("expo-background-task", () => ({
    BackgroundTaskResult: { Success: 1, Failed: 2 },
    BackgroundTaskStatus: { Restricted: 1, Available: 2 },
    getStatusAsync: jest.fn(),
    registerTaskAsync: jest.fn(),
}));
jest.mock("expo-task-manager", () => ({ defineTask: jest.fn(), isTaskRegisteredAsync: jest.fn() }));
jest.mock("@/hooks/useAuth", () => ({ getCachedUser: jest.fn() }));
jest.mock("@/api/rings", () => ({ getRingsToday: jest.fn(async () => ({ rings: 1 })) }));
jest.mock("@/hooks/useForYou", () => ({ FOR_YOU_KEY: ["forYou"], fetchForYou: jest.fn(async () => { throw new Error("offline"); }) }));
jest.mock("@/utils/workspaceSnapshot", () => ({
    fetchWorkspaceSnapshot: jest.fn(async () => ({ workspaces: [{ name: "Personal" }], templates: [] })),
    writeWorkspaceCache: jest.fn(async () => {}),
}));
jest.mock("@tanstack/react-query-persist-client", () => ({
    persistQueryClientRestore: jest.fn(async () => {}),
    persistQueryClientSave: jest.fn(async () => {}),
}));

import { getCachedUser } from "@/hooks/useAuth";
import { writeWorkspaceCache } from "@/utils/workspaceSnapshot";
import { persistQueryClientSave } from "@tanstack/react-query-persist-client";
import { queryClient } from "@/utils/queryClient";
import { refreshCachesInBackground } from "@/tasks/backgroundRefresh";

describe("refreshCachesInBackground", () => {
    beforeEach(() => jest.clearAllMocks());

    it("does nothing when nobody is signed in", async () => {
        (getCachedUser as jest.Mock).mockResolvedValue(null);
        await refreshCachesInBackground();
        expect(writeWorkspaceCache).not.toHaveBeenCalled();
        expect(persistQueryClientSave).not.toHaveBeenCalled();
    });

    it("writes the task cache and persists queries even when one fetch fails", async () => {
        (getCachedUser as jest.Mock).mockResolvedValue({ _id: "u1" });
        await refreshCachesInBackground();
        expect(writeWorkspaceCache).toHaveBeenCalledWith("u1", expect.objectContaining({ data: [{ name: "Personal" }] }));
        expect(queryClient.getQueryData(["rings", "today"])).toEqual({ rings: 1 });
        expect(persistQueryClientSave).toHaveBeenCalled();
    });
});
