// Pure widget-layout helpers and metadata. No React / API imports here so this
// stays trivially unit-testable; the data hook lives in hooks/useAnalyticsLayout.

export type WidgetId =
    | "categoryShare"
    | "progress"
    | "habits"
    | "heatmap"
    | "categoryHealth"
    | "workspaceHealth"
    | "kudosEffect"
    | "supportCoverage"
    | "weeklyReview";

export const DEFAULT_WIDGET_ORDER: WidgetId[] = [
    "categoryShare",
    "progress",
    "habits",
    "heatmap",
    "categoryHealth",
    "workspaceHealth",
    "kudosEffect",
    "supportCoverage",
    "weeklyReview",
];

export const WIDGET_TITLES: Record<WidgetId, string> = {
    categoryShare: "Where your time went",
    progress: "Progress",
    habits: "Habits & recurring",
    heatmap: "Activity heatmap",
    categoryHealth: "Category health",
    workspaceHealth: "Workspace health",
    kudosEffect: "Kudos effect",
    supportCoverage: "Support coverage",
    weeklyReview: "Weekly review",
};

export type WidgetCategory = "Progress" | "Health" | "Social" | "Rhythms" | "Habits";

export const WIDGET_CATEGORIES: WidgetCategory[] = ["Progress", "Health", "Rhythms", "Habits", "Social"];

export interface WidgetMeta {
    description: string;
    category: WidgetCategory;
    popular?: boolean;
}

// Gallery metadata for the Add Cards screen.
export const WIDGET_META: Record<WidgetId, WidgetMeta> = {
    categoryShare: { description: "Where your completed work went, by category.", category: "Progress", popular: true },
    progress: { description: "Tasks completed over time, stacked by category.", category: "Progress", popular: true },
    habits: { description: "Recurring tasks and how consistently you keep them up.", category: "Habits", popular: true },
    heatmap: { description: "Your activity calendar — tap a day to see what you finished.", category: "Rhythms", popular: true },
    categoryHealth: { description: "On-time rate, support, and status for each category.", category: "Health" },
    workspaceHealth: { description: "A quick health read across your workspaces.", category: "Health" },
    kudosEffect: { description: "How tasks with Kudos compare to those without.", category: "Social" },
    supportCoverage: { description: "How much of your finished work had support.", category: "Social" },
    weeklyReview: { description: "A guided recap of your week.", category: "Social" },
};

export function isWidgetId(value: unknown): value is WidgetId {
    return typeof value === "string" && (DEFAULT_WIDGET_ORDER as string[]).includes(value);
}

/** Pure array move; returns a new array with the item shifted from→to. */
export function moveItem<T>(arr: T[], from: number, to: number): T[] {
    if (from < 0 || from >= arr.length || to < 0 || to >= arr.length || from === to) {
        return arr.slice();
    }
    const next = arr.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
}

/** Drop unknown ids and append any newly-added widgets so the list stays valid. */
export function sanitizeOrder(order: unknown): WidgetId[] {
    const arr = Array.isArray(order) ? order.filter(isWidgetId) : [];
    const seen = new Set(arr);
    for (const id of DEFAULT_WIDGET_ORDER) {
        if (!seen.has(id)) arr.push(id);
    }
    return arr;
}
