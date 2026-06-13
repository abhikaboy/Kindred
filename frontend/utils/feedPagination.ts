type LoadMoreArgs = {
    feedId: string;
    feedItemCount: number;
    postCount: number;
    hasMore: boolean;
    loading: boolean;
    loadingMore: boolean;
};

// The feed tab renders feedItems; every other tab renders posts. Gate paging on
// the count of the list actually on screen, never the other (which is empty).
export const shouldLoadMoreFeed = ({
    feedId,
    feedItemCount,
    postCount,
    hasMore,
    loading,
    loadingMore,
}: LoadMoreArgs): boolean => {
    const renderedCount = feedId === "feed" ? feedItemCount : postCount;
    return hasMore && !loading && !loadingMore && renderedCount > 0;
};
