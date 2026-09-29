jest.mock("@/contexts/tasksContext", () => ({ useTasks: () => ({}) }));
jest.mock("@/api/plan", () => ({}));

import { groupSomedayByWorkspace, isSomedayTask, mergeSomedayTasks, sinkSomeday } from "@/hooks/useSomedayTasks";
import type { Task } from "@/api/types";

const t = (id: string, extra: Partial<Task> = {}): Task => ({ id, content: id, ...extra }) as Task;
const S = "2026-09-01T00:00:00Z";

describe("isSomedayTask", () => {
    it("needs somedayAt and no dates", () => {
        expect(isSomedayTask(t("a", { somedayAt: S }))).toBe(true);
        expect(isSomedayTask(t("b"))).toBe(false);
        expect(isSomedayTask(t("c", { somedayAt: null }))).toBe(false);
        expect(isSomedayTask(t("d", { somedayAt: S, deadline: S }))).toBe(false);
        expect(isSomedayTask(t("e", { somedayAt: S, startDate: S }))).toBe(false);
        expect(isSomedayTask(undefined)).toBe(false);
    });
});

describe("sinkSomeday", () => {
    it("moves Someday tasks to the end, keeping relative order", () => {
        const list = [t("s1", { somedayAt: S }), t("a"), t("s2", { somedayAt: S }), t("b", { deadline: S })];
        expect(sinkSomeday(list).map((x) => x.id)).toEqual(["a", "b", "s1", "s2"]);
    });
    it("returns the same array when there is nothing to sink", () => {
        const list = [t("a"), t("b")];
        expect(sinkSomeday(list)).toBe(list);
    });
});

describe("groupSomedayByWorkspace", () => {
    it("groups by workspace in workspace order, oldest saved first", () => {
        const tasks = [
            t("h2", { somedayAt: "2026-09-03T00:00:00Z", workspaceName: "Home" }),
            t("w1", { somedayAt: S, workspaceName: "Work" }),
            t("h1", { somedayAt: "2026-09-02T00:00:00Z", workspaceName: "Home" }),
            t("x", { somedayAt: S, workspaceName: "Zed" }),
            t("dated", { somedayAt: S, deadline: S, workspaceName: "Work" }),
            t("plain", { workspaceName: "Work" }),
        ];
        const groups = groupSomedayByWorkspace(tasks, ["Work", "Home"]);
        expect(groups.map((g) => g.workspace)).toEqual(["Work", "Home", "Zed"]);
        expect(groups[0].tasks.map((x) => x.id)).toEqual(["w1"]);
        expect(groups[1].tasks.map((x) => x.id)).toEqual(["h1", "h2"]);
    });
    it("is empty with no Someday tasks", () => {
        expect(groupSomedayByWorkspace([t("a")])).toEqual([]);
    });
});

describe("mergeSomedayTasks", () => {
    it("prefers live tasks so local changes win over the server fallback", () => {
        const live = [t("planned"), t("live", { somedayAt: S })];
        const fallback = [t("planned", { somedayAt: S }), t("remote", { somedayAt: S })];
        expect(mergeSomedayTasks(live, fallback).map((x) => x.id)).toEqual(["live", "remote"]);
    });
});
