import { guideFacts, isGuideCategory } from "@/utils/onboardingV2/guideFacts";
import { ONBOARDING_WORKSPACE } from "@/constants/spotlightConfig";

const guide = (categories: { id: string; tasks?: unknown[] }[]) => ({ name: ONBOARDING_WORKSPACE, categories });
const other = { name: "Personal", categories: [{ id: "p1", tasks: [{ id: "t" }] }] };

describe("guideFacts", () => {
    it("returns null when Kindred Guide is not loaded", () => {
        expect(guideFacts([other])).toBeNull();
    });

    it("reports no category or task for an empty guide", () => {
        expect(guideFacts([guide([])])).toEqual({ hasCategoryInGuide: false, hasTaskInGuide: false });
    });

    it("reports a category without tasks", () => {
        expect(guideFacts([guide([{ id: "c1", tasks: [] }])])).toEqual({
            hasCategoryInGuide: true,
            hasTaskInGuide: false,
        });
    });

    it("reports a task inside a guide category", () => {
        expect(guideFacts([other, guide([{ id: "c1", tasks: [{ id: "t1" }] }])])).toEqual({
            hasCategoryInGuide: true,
            hasTaskInGuide: true,
        });
    });

    it("ignores upcoming phantom categories", () => {
        expect(guideFacts([guide([{ id: "upcoming-🌺 Kindred Guide", tasks: [{ id: "x" }] }])])).toEqual({
            hasCategoryInGuide: false,
            hasTaskInGuide: false,
        });
    });

    it("ignores tasks in other workspaces", () => {
        expect(guideFacts([other, guide([{ id: "c1", tasks: [] }])])).toEqual({
            hasCategoryInGuide: true,
            hasTaskInGuide: false,
        });
    });
});

describe("isGuideCategory", () => {
    const workspaces = [other, guide([{ id: "g1" }])];

    it("matches a category in the guide", () => {
        expect(isGuideCategory(workspaces, "g1")).toBe(true);
    });

    it("rejects categories in other workspaces and unknown ids", () => {
        expect(isGuideCategory(workspaces, "p1")).toBe(false);
        expect(isGuideCategory(workspaces, "missing")).toBe(false);
        expect(isGuideCategory([other], "p1")).toBe(false);
    });
});
