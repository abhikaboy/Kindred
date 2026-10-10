import { ONBOARDING_WORKSPACE } from "@/constants/spotlightConfig";
import type { OnboardingV2GuideFacts } from "./machine";

type GuideCategory = { id: string; name?: string; tasks?: readonly unknown[] };
type GuideWorkspace = { name: string; categories: readonly GuideCategory[] };

// tasksContext injects "upcoming-*" phantom categories. They are not real categories.
// New workspaces also carry a hidden "!-proxy-!" category.
const isPhantom = (category: GuideCategory & { name?: string }) =>
    category.id.startsWith("upcoming-") || category.name === "!-proxy-!";

/** Facts for steps 2 and 3, or null when Kindred Guide is not in the workspace list. */
export function guideFacts(workspaces: readonly GuideWorkspace[]): OnboardingV2GuideFacts | null {
    const guide = workspaces.find((ws) => ws.name === ONBOARDING_WORKSPACE);
    if (!guide) return null;
    const categories = guide.categories.filter((c) => !isPhantom(c));
    return {
        hasCategoryInGuide: categories.length > 0,
        hasTaskInGuide: categories.some((c) => (c.tasks?.length ?? 0) > 0),
    };
}

/** True when `categoryId` is a category of Kindred Guide. */
export function isGuideCategory(workspaces: readonly GuideWorkspace[], categoryId: string): boolean {
    const guide = workspaces.find((ws) => ws.name === ONBOARDING_WORKSPACE);
    return guide?.categories.some((c) => c.id === categoryId) ?? false;
}
