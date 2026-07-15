import { useMemo } from "react";
import { $api } from "@/lib/api/query";
import type { components } from "@/lib/api/types.gen";

export type FeedItem = components["schemas"]["FeedItem"];

// Infinite feed over GET /v1/user/feed. Page param is the `offset` query param;
// getNextPageParam reads hasMore/nextOffset from the last page.
export function useFeed(): {
  items: FeedItem[];
  isLoading: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  isFetchingNextPage: boolean;
  error: unknown;
} {
  const query = $api.useInfiniteQuery(
    "get",
    "/v1/user/feed",
    { params: { header: { Authorization: "" }, query: { limit: 20 } } },
    {
      getNextPageParam: (last) => (last.hasMore ? last.nextOffset : undefined),
      initialPageParam: 0,
      pageParamName: "offset",
    }
  );

  const items = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data]
  );

  return {
    items,
    isLoading: query.isLoading,
    hasNextPage: query.hasNextPage,
    fetchNextPage: () => {
      void query.fetchNextPage();
    },
    isFetchingNextPage: query.isFetchingNextPage,
    error: query.error,
  };
}
