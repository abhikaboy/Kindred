import { shouldLoadMoreFeed } from "@/utils/feedPagination";

const base = {
    feedItemCount: 0,
    postCount: 0,
    hasMore: true,
    loading: false,
    loadingMore: false,
};

describe("shouldLoadMoreFeed", () => {
    test("feed tab pages off feed items, not posts (posts is always cleared there)", () => {
        // Regression: gating on postCount left infinite scroll dead on the feed tab.
        expect(shouldLoadMoreFeed({ ...base, feedId: "feed", feedItemCount: 20, postCount: 0 })).toBe(true);
    });

    test("non-feed tabs page off posts", () => {
        expect(shouldLoadMoreFeed({ ...base, feedId: "friends", feedItemCount: 0, postCount: 8 })).toBe(true);
    });

    test("does not page when the rendered list is empty (guards the initial mount)", () => {
        expect(shouldLoadMoreFeed({ ...base, feedId: "feed", feedItemCount: 0 })).toBe(false);
        expect(shouldLoadMoreFeed({ ...base, feedId: "friends", postCount: 0 })).toBe(false);
    });

    test("does not page while loading, paging, or out of pages", () => {
        const ready = { ...base, feedId: "feed", feedItemCount: 20 };
        expect(shouldLoadMoreFeed({ ...ready, hasMore: false })).toBe(false);
        expect(shouldLoadMoreFeed({ ...ready, loading: true })).toBe(false);
        expect(shouldLoadMoreFeed({ ...ready, loadingMore: true })).toBe(false);
    });
});
