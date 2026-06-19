import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAnalyticsLayout, saveAnalyticsLayout, AnalyticsLayout } from "@/api/analytics";
import { WidgetId, DEFAULT_WIDGET_ORDER, sanitizeOrder, isWidgetId, moveItem } from "@/components/analytics/analyticsLayout";

const queryKeyFor = (userId?: string) => ["analytics", "layout", userId ?? "anon"];

/**
 * Server-synced, reorderable widget layout (TanStack Query over the typed
 * openapi-fetch client). The layout is persisted on the user so it follows them
 * across devices and is shared across screens through one query cache —
 * reordering in Edit shows up on the dashboard immediately. Falls back to the
 * default order when nothing is saved.
 */
export function useAnalyticsLayout(userId?: string) {
    const qc = useQueryClient();
    const queryKey = queryKeyFor(userId);

    const { data, isLoading } = useQuery({
        queryKey,
        queryFn: getAnalyticsLayout,
        enabled: !!userId,
        staleTime: 60_000,
        placeholderData: { order: DEFAULT_WIDGET_ORDER, hidden: [] } as AnalyticsLayout,
    });

    const order = sanitizeOrder(data?.order);
    const hidden = ((data?.hidden ?? []) as string[]).filter(isWidgetId);

    const save = useMutation({ mutationFn: saveAnalyticsLayout });

    const apply = useCallback(
        (nextOrder: WidgetId[], nextHidden: WidgetId[]) => {
            qc.setQueryData(queryKeyFor(userId), { order: nextOrder, hidden: nextHidden });
            save.mutate({ order: nextOrder, hidden: nextHidden });
        },
        [qc, save, userId],
    );

    const moveWidget = useCallback((from: number, to: number) => apply(moveItem(order, from, to), hidden), [apply, order, hidden]);

    const toggleHidden = useCallback(
        (id: WidgetId) => apply(order, hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id]),
        [apply, order, hidden],
    );

    const addWidget = useCallback(
        (id: WidgetId) => {
            const nextOrder = order.includes(id) ? order : [...order, id];
            apply(nextOrder, hidden.filter((x) => x !== id));
        },
        [apply, order, hidden],
    );

    const reset = useCallback(() => apply(DEFAULT_WIDGET_ORDER, []), [apply]);

    const visible = order.filter((id) => !hidden.includes(id));
    const isVisible = (id: WidgetId) => order.includes(id) && !hidden.includes(id);

    return { order, hidden, visible, loaded: !isLoading, moveWidget, toggleHidden, addWidget, reset, isVisible };
}
