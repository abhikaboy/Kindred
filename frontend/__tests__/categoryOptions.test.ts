import { renderHook, act } from "@testing-library/react-native";
import { hasExactMatch, listCategories, rankCategories } from "@/components/modals/create/composer/categoryOptions";
import { useInlineTrigger } from "@/hooks/useInlineTrigger";
import type { Workspace } from "@/api/types";

const ws = (name: string, categories: string[], isBlueprint = false): Workspace => ({
    name,
    isBlueprint,
    categories: categories.map((c) => ({ id: `${name}/${c}`, name: c, tasks: [] }) as any),
});

const workspaces = [
    ws("Personal", ["Health", "Side Projects", "Home", "!-proxy-!"]),
    ws("Work", ["Hiring", "Planning"]),
    ws("Marathon", ["Training"], true),
];

describe("listCategories", () => {
    it("skips blueprints and the proxy placeholder", () => {
        expect(listCategories(workspaces).map((o) => o.id)).toEqual([
            "Personal/Health",
            "Personal/Side Projects",
            "Personal/Home",
            "Work/Hiring",
            "Work/Planning",
        ]);
    });
});

describe("rankCategories", () => {
    const options = listCategories(workspaces);
    const names = (q: string, extra = {}) => rankCategories(options, q, extra).map((o) => o.name);

    it("matches across spaces and case", () => {
        expect(names("sideproj")).toEqual(["Side Projects"]);
        expect(names("PROJ")).toEqual(["Side Projects"]);
    });

    it("puts prefix matches before substring matches", () => {
        expect(names("h")).toEqual(["Health", "Home", "Hiring"]);
    });

    it("breaks ties toward the suggestion, then the viewed workspace", () => {
        expect(names("h", { workspace: "Work" })).toEqual(["Hiring", "Health", "Home"]);
        expect(names("h", { workspace: "Work", suggestedId: "Personal/Home" })).toEqual(["Home", "Hiring", "Health"]);
    });

    it("ranks an exact name first", () => {
        expect(names("home", { suggestedId: "Personal/Health" })[0]).toBe("Home");
    });

    it("returns everything for an empty query", () => {
        expect(names("")).toHaveLength(options.length);
    });
});

describe("hasExactMatch", () => {
    const options = listCategories(workspaces);
    it("is scoped to the workspace", () => {
        expect(hasExactMatch(options, "side projects", "Personal")).toBe(true);
        expect(hasExactMatch(options, "sideprojects", "Personal")).toBe(true);
        expect(hasExactMatch(options, "Hiring", "Personal")).toBe(false);
    });
});

describe("useInlineTrigger", () => {
    const setup = (initial: string) => {
        let value = initial;
        const hook = renderHook(() =>
            useInlineTrigger(value, (v) => (value = v), ["#", "@"])
        );
        const type = (text: string) => {
            act(() => hook.result.current.onChangeText(text));
            value = text;
            act(() =>
                hook.result.current.onSelectionChange({
                    nativeEvent: { selection: { start: text.length, end: text.length } },
                } as any)
            );
            hook.rerender({});
        };
        return { hook, type, get value() { return value; } };
    };

    it("finds a # token at the caret", () => {
        const t = setup("");
        t.type("Call dentist #hea");
        expect(t.hook.result.current.token).toEqual({ char: "#", query: "hea" });
    });

    it("ignores a trigger inside a word", () => {
        const t = setup("");
        t.type("email a@b");
        expect(t.hook.result.current.token).toBeNull();
    });

    it("ends the token at whitespace", () => {
        const t = setup("");
        t.type("Call #health ");
        expect(t.hook.result.current.token).toBeNull();
    });

    it("removes the token and its space when replaced with nothing", () => {
        const t = setup("");
        t.type("Call dentist #hea");
        act(() => t.hook.result.current.replace(""));
        expect(t.value).toBe("Call dentist");
    });

    it("replaces an @ token with the handle", () => {
        const t = setup("");
        t.type("Lunch with @sa");
        act(() => t.hook.result.current.replace("@sam "));
        expect(t.value).toBe("Lunch with @sam ");
    });
});

import { quickMoments } from "@/components/modals/create/composer/quickMoments";

describe("quickMoments", () => {
    // Wednesday, Oct 1 2026
    const wed = (h: number, m = 0) => new Date(2026, 9, 1, h, m);
    const keys = (now: Date, target: "start" | "due" = "start") => quickMoments(now, target).map((m) => m.key);

    it("drops Tonight once the evening has started", () => {
        expect(keys(wed(10))).toContain("tonight");
        expect(keys(wed(19, 45))).not.toContain("tonight");
    });

    it("rounds In an hour up to the quarter", () => {
        const [hour] = quickMoments(wed(10, 7), "start");
        expect(hour.at.getHours()).toBe(11);
        expect(hour.at.getMinutes()).toBe(15);
    });

    it("starts at the moment but is due at the end of the day", () => {
        const tomorrowStart = quickMoments(wed(10), "start").find((m) => m.key === "tomorrow")!;
        const tomorrowDue = quickMoments(wed(10), "due").find((m) => m.key === "tomorrow")!;
        expect(tomorrowStart.at.getHours()).toBe(9);
        expect(tomorrowDue.at.getHours()).toBe(23);
        expect(tomorrowDue.at.getDate()).toBe(2);
    });

    it("lands the weekend on Saturday and next week on Monday", () => {
        const moments = quickMoments(wed(10), "start");
        expect(moments.find((m) => m.key === "weekend")!.at.getDay()).toBe(6);
        expect(moments.find((m) => m.key === "week")!.at.getDay()).toBe(1);
    });

    it("offers next weekend on a Saturday", () => {
        const sat = new Date(2026, 9, 3, 10);
        expect(quickMoments(sat, "start").find((m) => m.key === "weekend")!.label).toBe("Next weekend");
    });
});
