import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type WidgetId =
    | "categoryShare"
    | "progress"
    | "habits"
    | "heatmap"
    | "categoryHealth"
    | "workspaceHealth";

export const DEFAULT_WIDGET_ORDER: WidgetId[] = [
    "categoryShare",
    "progress",
    "habits",
    "heatmap",
    "categoryHealth",
    "workspaceHealth",
];

export const WIDGET_TITLES: Record<WidgetId, string> = {
    categoryShare: "Where your time went",
    progress: "Progress",
    habits: "Habits & recurring",
    heatmap: "Activity heatmap",
    categoryHealth: "Category health",
    workspaceHealth: "Workspace health",
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

// v2: dropped the signal strip and reordered (Category Share first). The key
// bump resets stale persisted layouts to the new default.
const keyFor = (userId?: string) => (userId ? `analytics_layout_v2_${userId}` : null);

/**
 * Persisted, reorderable widget layout. Stored locally (AsyncStorage) for
 * Phase 1; server sync is a later phase.
 */
export function useAnalyticsLayout(userId?: string) {
    const [order, setOrder] = useState<WidgetId[]>(DEFAULT_WIDGET_ORDER);
    const [hidden, setHidden] = useState<WidgetId[]>([]);
    const [loaded, setLoaded] = useState(false);
    const key = keyFor(userId);

    useEffect(() => {
        let active = true;
        (async () => {
            if (!key) {
                setLoaded(true);
                return;
            }
            try {
                const raw = await AsyncStorage.getItem(key);
                if (active && raw) {
                    const parsed = JSON.parse(raw);
                    setOrder(sanitizeOrder(parsed.order));
                    setHidden(Array.isArray(parsed.hidden) ? parsed.hidden.filter(isWidgetId) : []);
                }
            } catch {
                // fall back to defaults
            } finally {
                if (active) setLoaded(true);
            }
        })();
        return () => {
            active = false;
        };
    }, [key]);

    const persist = useCallback(
        (o: WidgetId[], h: WidgetId[]) => {
            if (key) AsyncStorage.setItem(key, JSON.stringify({ order: o, hidden: h })).catch(() => {});
        },
        [key],
    );

    const moveWidget = useCallback(
        (from: number, to: number) => {
            setOrder((prev) => {
                const next = moveItem(prev, from, to);
                persist(next, hidden);
                return next;
            });
        },
        [hidden, persist],
    );

    const toggleHidden = useCallback(
        (id: WidgetId) => {
            setHidden((prev) => {
                const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
                persist(order, next);
                return next;
            });
        },
        [order, persist],
    );

    const reset = useCallback(() => {
        setOrder(DEFAULT_WIDGET_ORDER);
        setHidden([]);
        persist(DEFAULT_WIDGET_ORDER, []);
    }, [persist]);

    const visible = order.filter((id) => !hidden.includes(id));

    return { order, hidden, visible, loaded, moveWidget, toggleHidden, reset };
}
