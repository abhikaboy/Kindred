jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { _id: "u1" } }) }));
jest.mock("@/api/task", () => ({
    getUserTemplatesAPI: jest.fn(() => Promise.resolve([])),
    moveTaskAPI: jest.fn(() => Promise.resolve()),
}));
jest.mock("@/api/workspace", () => ({ fetchUserWorkspaces: jest.fn() }));
jest.mock("@/api/blueprint", () => ({ getUserSubscribedBlueprints: jest.fn(() => Promise.resolve([])) }));
jest.mock("@/api/category", () => ({
    renameWorkspace: jest.fn(() => Promise.resolve()),
    renameCategory: jest.fn(() => Promise.resolve()),
    updateWorkspaceMeta: jest.fn(() => Promise.resolve()),
}));
jest.mock("react-native-toastable", () => ({ showToastable: jest.fn() }));
jest.mock("@/components/ui/DefaultToast", () => () => null);
jest.mock("@/widgets/widgetUpdaters", () => {
    const updater = { updateSnapshot: jest.fn() };
    return {
        TodayTasksWidgetUpdater: updater,
        WorkspaceSnapshotWidgetUpdater: updater,
        LockScreenCircularWidgetUpdater: updater,
        LockScreenRectangularWidgetUpdater: updater,
    };
});

import React from "react";
import { act, render, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    TasksProvider,
    useTaskActions,
    useTasksSelector,
    TaskActions,
    TasksState,
} from "@/contexts/tasksContext";
import { fetchUserWorkspaces } from "@/api/workspace";
import { moveTaskAPI } from "@/api/task";
import { Workspace } from "@/api/types";

const tree = (): Workspace[] =>
    [
        {
            name: "A",
            isBlueprint: false,
            categories: [
                { id: "a1", name: "A1", tags: [], tasks: [{ id: "t1", content: "one" }, { id: "t2", content: "two" }] },
                { id: "a2", name: "A2", tags: [], tasks: [] },
            ],
        },
        {
            name: "B",
            isBlueprint: false,
            categories: [{ id: "b1", name: "B1", tags: [], tasks: [{ id: "t3", content: "three" }] }],
        },
    ] as any;

function setup() {
    const out: { actions?: TaskActions; state?: TasksState; bRenders: number } = { bRenders: 0 };
    const Probe = () => {
        out.actions = useTaskActions();
        out.state = useTasksSelector((s) => s);
        return null;
    };
    const BWatcher = React.memo(() => {
        useTasksSelector((s) => s.workspaces.find((w) => w.name === "B"));
        out.bRenders++;
        return null;
    });
    render(
        <TasksProvider>
            <Probe />
            <BWatcher />
        </TasksProvider>
    );
    return out;
}

beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    (fetchUserWorkspaces as jest.Mock).mockResolvedValue(tree());
});

describe("TasksProvider", () => {
    it("loads on mount and keeps untouched workspaces referentially stable", async () => {
        const out = setup();
        await waitFor(() => expect(out.state!.workspaces).toHaveLength(2));
        expect(fetchUserWorkspaces).toHaveBeenCalledTimes(1);

        const before = out.state!.workspaces;
        const actionsBefore = out.actions;
        const bRendersBefore = out.bRenders;

        act(() => out.actions!.updateTask("a1", "t1", { content: "edited" }));

        const after = out.state!.workspaces;
        expect(after).not.toBe(before);
        expect(after[1]).toBe(before[1]);
        expect(after[0].categories[1]).toBe(before[0].categories[1]);
        expect(after[0].categories[0].tasks[1]).toBe(before[0].categories[0].tasks[1]);
        expect(out.actions!.getTaskById("a1", "t1")?.content).toBe("edited");
        expect(out.actions).toBe(actionsBefore);
        expect(out.bRenders).toBe(bRendersBefore);
    });

    it("getSelected reflects setSelected before subscribers see it", async () => {
        const out = setup();
        await waitFor(() => expect(out.state!.workspaces).toHaveLength(2));
        let seenInSameTick: string | undefined;
        act(() => {
            out.actions!.setSelected("B");
            // Selector snapshots lag a render; the pager's sync relies on this not lagging.
            seenInSameTick = out.actions!.getSelected();
        });
        expect(seenInSameTick).toBe("B");
        expect(out.state!.selected).toBe("B");
    });

    it("dedupes fetches and serves fresh data without refetching", async () => {
        const out = setup();
        await waitFor(() => expect(out.state!.workspaces).toHaveLength(2));
        await act(() => Promise.all([out.actions!.fetchWorkspaces(), out.actions!.fetchWorkspaces()]));
        expect(fetchUserWorkspaces).toHaveBeenCalledTimes(1);
        await act(() => out.actions!.fetchWorkspaces(true));
        expect(fetchUserWorkspaces).toHaveBeenCalledTimes(2);
    });

    it("rolls back a failed move without clobbering concurrent edits", async () => {
        const out = setup();
        await waitFor(() => expect(out.state!.workspaces).toHaveLength(2));
        let reject!: (e: Error) => void;
        (moveTaskAPI as jest.Mock).mockImplementationOnce(() => new Promise((_, r) => { reject = r; }));

        let pending!: Promise<void>;
        act(() => { pending = out.actions!.moveTask("a1", "t2", "b1"); });
        expect(out.state!.workspaces[1].categories[0].tasks.map((t) => t.id)).toEqual(["t2", "t3"]);

        act(() => out.actions!.updateTask("b1", "t3", { content: "concurrent" }));
        await act(async () => { reject(new Error("nope")); await pending; });

        const [a, b] = out.state!.workspaces;
        expect(a.categories[0].tasks.map((t) => t.id)).toEqual(["t1", "t2"]);
        expect(a.categories[0].tasks[1].categoryName).toBe("A1");
        expect(b.categories[0].tasks.map((t) => t.content)).toEqual(["concurrent"]);
    });

    it("hydrates from a stale cache and revalidates in the background", async () => {
        const cached = tree();
        cached[0].categories[0].tasks = [];
        await AsyncStorage.setItem(
            "workspaces_cache_u1",
            JSON.stringify({ data: cached, timestamp: Date.now() - 60 * 60 * 1000, templates: [] })
        );
        const out = setup();
        await waitFor(() => expect(out.state!.workspaces).toHaveLength(2));
        await waitFor(() => expect(out.state!.workspaces[0].categories[0].tasks).toHaveLength(2));
        expect(fetchUserWorkspaces).toHaveBeenCalledTimes(1);
        expect(out.state!.isShowingStaleData).toBe(false);
    });
});
