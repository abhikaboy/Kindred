import { useQuery } from "@tanstack/react-query";
import { getAnalytics, AnalyticsFilters } from "@/api/analytics";

/**
 * React Query hook for the analytics dashboard. Named to avoid clobbering the
 * PostHog `useAnalytics` hook.
 */
export function useAnalyticsData(filters: AnalyticsFilters) {
    return useQuery({
        queryKey: ["analytics", filters.range, filters.workspace ?? "all", filters.category ?? "all"],
        queryFn: () => getAnalytics(filters),
        staleTime: 60_000,
    });
}
