const mockStore: Record<string, string> = {};
jest.mock("@react-native-async-storage/async-storage", () => ({
    getAllKeys: jest.fn(() => Promise.resolve(Object.keys(mockStore))),
    multiGet: jest.fn((keys: string[]) => Promise.resolve(keys.map((k) => [k, mockStore[k] ?? null]))),
    getItem: jest.fn((k: string) => Promise.resolve(mockStore[k] ?? null)),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { isToday, isThisWeek, isFuture, isPast } from "date-fns";
import {
    getWorkspaceViewState,
    subscribeWorkspaceViewState,
    DEFAULT_WORKSPACE_STATE,
    __resetWorkspaceViewStateForTests,
} from "@/hooks/workspaceViewStateStore";
import { filterTasks, FilterState } from "@/hooks/useWorkspaceFilters";
import { workspaceStateEvents } from "@/utils/workspaceStateEvents";
import { Task } from "@/api/types";

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("workspaceViewStateStore", () => {
    beforeEach(() => {
        Object.keys(mockStore).forEach((k) => delete mockStore[k]);
        __resetWorkspaceViewStateForTests();
        jest.clearAllMocks();
    });

    it("loads every workspace with one getAllKeys + multiGet and keeps sort vs sort-direction apart", async () => {
        mockStore["workspace-sort-Work"] = "alphabetical";
        mockStore["workspace-sort-direction-Work"] = "ascending";
        mockStore["workspace-group-Work"] = "day";
        mockStore["workspace-visibility-Home"] = "private";
        mockStore["workspace-filters-Home"] = JSON.stringify({ priorities: { low: true, medium: false, high: false }, deadlines: {} });

        const unsub = subscribeWorkspaceViewState(() => {});
        await flush();

        expect(AsyncStorage.getAllKeys).toHaveBeenCalledTimes(1);
        expect(AsyncStorage.multiGet).toHaveBeenCalledTimes(1);
        expect(getWorkspaceViewState("Work")).toEqual({
            filters: null,
            sort: "alphabetical",
            sortDirection: "ascending",
            isPublic: true,
            groupByDay: true,
        });
        expect(getWorkspaceViewState("Home").isPublic).toBe(false);
        expect(getWorkspaceViewState("Home").filters?.priorities.low).toBe(true);
        expect(getWorkspaceViewState("Unknown")).toBe(DEFAULT_WORKSPACE_STATE);
        unsub();
    });

    it("re-reads a workspace's keys when workspaceStateEvents fires", async () => {
        const listener = jest.fn();
        const unsub = subscribeWorkspaceViewState(listener);
        await flush();
        const before = getWorkspaceViewState("Work");

        mockStore["workspace-group-Work"] = "day";
        workspaceStateEvents.emit("Work");
        await flush();
        await flush();

        expect(getWorkspaceViewState("Work").groupByDay).toBe(true);
        expect(getWorkspaceViewState("Work")).not.toBe(before);
        expect(listener).toHaveBeenCalled();
        unsub();
    });
});

describe("filterTasks", () => {
    const allDeadlines = (over: Partial<FilterState["deadlines"]>): FilterState => ({
        priorities: { low: false, medium: false, high: false },
        deadlines: { overdue: false, today: false, thisWeek: false, future: false, none: false, ...over },
    });

    // Reference implementation: the per-task date-fns checks filterTasks replaced.
    const reference = (deadline: string, key: keyof FilterState["deadlines"]) => {
        const d = new Date(deadline);
        switch (key) {
            case "overdue":
                return isPast(d) && !isToday(d);
            case "today":
                return isToday(d);
            case "thisWeek":
                return isThisWeek(d, { weekStartsOn: 0 });
            case "future":
                return isFuture(d) && !isToday(d) && !isThisWeek(d, { weekStartsOn: 0 });
            default:
                return false;
        }
    };

    it("matches the date-fns deadline semantics across a range of offsets", () => {
        const now = Date.now();
        const hour = 60 * 60 * 1000;
        const tasks = Array.from({ length: 24 * 20 }, (_, i) => ({
            id: `t${i}`,
            priority: 1,
            deadline: new Date(now + (i - 24 * 10) * hour + 1000).toISOString(),
        })) as unknown as Task[];

        (["overdue", "today", "thisWeek", "future"] as const).forEach((key) => {
            const got = new Set(filterTasks(tasks, allDeadlines({ [key]: true }), new Date(now)).map((t) => t.id));
            tasks.forEach((t) => {
                expect([key, t.deadline, got.has(t.id)]).toEqual([key, t.deadline, reference(t.deadline!, key)]);
            });
        });
    });

    it("returns the same array when no filters are active", () => {
        const tasks = [{ id: "a", priority: 1 }] as unknown as Task[];
        expect(filterTasks(tasks, null)).toBe(tasks);
        expect(filterTasks(tasks, allDeadlines({}))).toBe(tasks);
    });
});
