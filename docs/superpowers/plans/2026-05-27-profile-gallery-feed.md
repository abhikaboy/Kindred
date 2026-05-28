# Profile Gallery Vertical Feed — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace single-post navigation from gallery thumbnails with a vertically-scrollable feed of `PostCard`s anchored on the tapped post.

**Architecture:** A shared `useInfiniteQuery` hook backs both gallery grids and a new full-screen feed route. The gallery loads pages → user taps a thumbnail → new route opens, reads the same cache, and scrolls to the tapped post. Forward pagination continues via `fetchNextPage`. Image-only filtering lives in the hook's `select` so grid and feed share identical indices.

**Tech Stack:**
- `@tanstack/react-query@^5.90.2` (`useInfiniteQuery`)
- `@shopify/flash-list@2.0.2`
- `expo-router@~55.0.11`
- Reuses existing `PostCard` component

**Testing approach:** Frontend has minimal test infrastructure (`__tests__/AboutScreen.test.tsx` is the only test). Following the codebase norm, verification is via manual smoke testing on simulator. Each task ends with explicit smoke-test steps + a commit.

**Source spec:** `docs/superpowers/specs/2026-05-27-profile-gallery-feed-design.md`

---

## File Structure

**New files**
- `frontend/hooks/useGalleryPostsInfinite.ts` — shared infinite-query hook (~80 LOC).
- `frontend/app/(logged-in)/(tabs)/(feed,search,profile)/gallery-feed/[id].tsx` — new route, the feed view (~180 LOC).

**Modified files**
- `frontend/components/profile/ProfileGallery.tsx` — replace local state with hook; preserve `useImperativeHandle` surface; swap nav target.
- `frontend/components/profile/BlueprintGallery.tsx` — swap nav target (no state migration needed; data is non-paginated).

**Untouched**
- `frontend/app/(logged-in)/posting/[id].tsx` — single-post route stays for notifications, share links, deep links.
- `frontend/api/post.ts` — existing API functions are reused, no signature changes.
- `frontend/components/cards/PostCard.tsx` — already invalidates `['userPosts', userId]` on delete; that key is reused by the new hook so deletes propagate automatically.
- All backend / OpenAPI / generated types.

---

## Task 1: Add the shared infinite-query hook

**Files:**
- Create: `frontend/hooks/useGalleryPostsInfinite.ts`

- [ ] **Step 1: Create the hook file**

Write `frontend/hooks/useGalleryPostsInfinite.ts`:

```ts
import { useInfiniteQuery } from "@tanstack/react-query";
import { getUserPosts, getPostsByBlueprint, type Post } from "@/api/post";

type Kind = "user" | "blueprint";

const PAGE_SIZE = 12;

export interface GalleryPage {
    posts: Post[];
    hasMore: boolean;
    nextOffset: number;
}

const filterImagePosts = (posts: Post[]): Post[] =>
    posts.filter((p) => Array.isArray(p.images) && p.images.length > 0);

const sortByCreatedDesc = (posts: Post[]): Post[] =>
    [...posts].sort((a, b) => {
        const da = new Date(a.metadata?.createdAt || 0).getTime();
        const db = new Date(b.metadata?.createdAt || 0).getTime();
        return db - da;
    });

/**
 * Shared infinite query for posts shown in galleries.
 *
 * Cache keys:
 *   user      -> ["userPosts", id]    (matches PostCard invalidations)
 *   blueprint -> ["blueprintPosts", id]
 *
 * `select` returns a flat, image-only, newest-first array so consumers
 * (grid + feed view) work off identical indices.
 */
export function useGalleryPostsInfinite(kind: Kind, id: string | undefined) {
    return useInfiniteQuery({
        queryKey: kind === "user" ? ["userPosts", id] : ["blueprintPosts", id],
        enabled: !!id,
        initialPageParam: 0,
        queryFn: async ({ pageParam }): Promise<GalleryPage> => {
            if (kind === "user") {
                const r = await getUserPosts(id as string, PAGE_SIZE, pageParam as number);
                return { posts: r.posts, hasMore: r.hasMore, nextOffset: r.nextOffset };
            }
            const posts = await getPostsByBlueprint(id as string);
            return { posts, hasMore: false, nextOffset: 0 };
        },
        getNextPageParam: (last) => (last.hasMore ? last.nextOffset : undefined),
        select: (data) => {
            const flat = data.pages.flatMap((p) => p.posts);
            return {
                posts: sortByCreatedDesc(filterImagePosts(flat)),
                pageParams: data.pageParams,
                pages: data.pages,
            };
        },
    });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run from `frontend/`:
```bash
bun run tsc --noEmit 2>&1 | head -30
```
Expected: no new errors mentioning `useGalleryPostsInfinite.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/hooks/useGalleryPostsInfinite.ts
git commit -m "feat: add shared infinite query hook for gallery posts"
```

---

## Task 2: Migrate `ProfileGallery` to the shared hook

Replaces the local `useState` / `fetchImages` / `handleLoadMore` machinery with the hook while preserving:
- The 3×3 thumbnail layout.
- The skeleton + empty states.
- The long-press menu (View Post / Delete Post / Cancel).
- The `useImperativeHandle` surface exposing `loadMore()` and `hasMore` — `profile.tsx` and `account/[id].tsx` both call these from scroll handlers (see `frontend/app/(logged-in)/(tabs)/(profile)/profile.tsx:52-53` and `account/[id].tsx:86-87`).
- The `legacy-*` postId behavior for the legacy `images` prop (no navigation).
- The current nav target (`posting/{postId}`) — switching the nav target is Task 4, kept separate so this task is purely a refactor.

**Files:**
- Modify: `frontend/components/profile/ProfileGallery.tsx`

- [ ] **Step 1: Replace state + fetch logic with the hook**

In `frontend/components/profile/ProfileGallery.tsx`:

Remove these blocks:
- `getAllPosts, getUserPosts` from the `@/api/post` import (delete the names; keep `deletePost`).
- The `useEffect` that fetches images (lines 140-181).
- `handleLoadMore` (lines 184-207).
- The `useState`s for `postImages`, `isLoading`, `isLoadingMore`, `hasMore`, `offset` (lines 110-115).
- The `mapPostsToImages` helper (lines 123-138) — no longer needed; the hook already filters and sorts.
- The `loadingMoreRef` (line 183).

Add these imports at the top:
```ts
import { useGalleryPostsInfinite } from "@/hooks/useGalleryPostsInfinite";
import { useQueryClient } from "@tanstack/react-query";
```

Replace the body of `ProfileGalleryComponent` above the alert state with:
```ts
const { user } = useAuth();
const ThemedColor = useThemeColor();
const queryClient = useQueryClient();
const [deletingPosts, setDeletingPosts] = useState<Set<string>>(new Set());

// Alert state
const [alertVisible, setAlertVisible] = useState(false);
const [alertTitle, setAlertTitle] = useState("");
const [alertMessage, setAlertMessage] = useState("");
const [alertButtons, setAlertButtons] = useState<AlertButton[]>([]);

const legacyImages: PostImage[] | null = useMemo(() => {
    if (!images || images.length === 0) return null;
    return images.map((imageUrl, index) => ({
        imageUrl,
        postId: `legacy-${index}`,
        postUserId: "",
    }));
}, [images]);

const queryResult = useGalleryPostsInfinite("user", legacyImages ? undefined : userId);
const isLoading = queryResult.isPending && !legacyImages;
const isLoadingMore = queryResult.isFetchingNextPage;
const hasMore = !!queryResult.hasNextPage;

const postImages: PostImage[] = useMemo(() => {
    if (legacyImages) return legacyImages;
    const posts = queryResult.data?.posts ?? [];
    return posts.map((post) => ({
        imageUrl: post.images[0],
        postId: post._id,
        postUserId: post.user?._id || userId || "",
    }));
}, [legacyImages, queryResult.data, userId]);

const handleLoadMore = useCallback(() => {
    if (queryResult.hasNextPage && !queryResult.isFetchingNextPage) {
        queryResult.fetchNextPage();
    }
}, [queryResult]);
```

Add `useMemo` to the React import at the top of the file:
```ts
import React, { useEffect, useState, useRef, useCallback, useImperativeHandle, forwardRef, useMemo } from "react";
```

Leave the `useImperativeHandle` block intact (lines 209-212 in the original file) — it now proxies to the hook through `handleLoadMore` and `hasMore` and the parent screens keep working unchanged.

- [ ] **Step 2: Update `handleDeletePost` to invalidate the shared cache**

Replace the existing `handleDeletePost` (lines 294-315 in the original) with:
```ts
const handleDeletePost = async (postId: string) => {
    setDeletingPosts((prev) => new Set([...prev, postId]));

    try {
        await deletePost(postId);
        // Invalidate the shared cache so both grid and any open feed view refresh.
        queryClient.invalidateQueries({ queryKey: ["userPosts", userId] });
        showToast("Post deleted successfully", "success");
    } catch (error) {
        console.error("Failed to delete post:", error);
        setDeletingPosts((prev) => {
            const next = new Set(prev);
            next.delete(postId);
            return next;
        });
        showToast("Failed to delete post", "danger");
    }
};
```

Note: we no longer mutate a local `postImages` state — the cache invalidation is the source of truth.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && bun run tsc --noEmit 2>&1 | grep -E "ProfileGallery|useGalleryPostsInfinite" | head -20
```
Expected: empty output.

- [ ] **Step 4: Smoke test on simulator**

Run the app:
```bash
cd frontend && bun run ios   # or: bun run start
```

Verify on the simulator:
1. Open your own profile tab → gallery thumbnails load → confirm same posts as before.
2. Scroll the profile screen near the bottom → confirm more thumbnails load (the parent's `handleScroll` still drives pagination through the imperative handle).
3. Tap a thumbnail → still goes to `posting/[id].tsx` (nav target change is Task 4).
4. Long-press a thumbnail on a post you own → menu appears with View Post + Delete Post.
5. Long-press → Delete Post → confirm → post disappears from grid, success toast shows.
6. Open another user's profile via `account/[id]` → their gallery loads correctly.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/profile/ProfileGallery.tsx
git commit -m "refactor: migrate ProfileGallery to shared useGalleryPostsInfinite hook"
```

---

## Task 3: Build the new `gallery-feed/[id]` route

Creates the feed view route. Renders a `FlashList` of `PostCard`s reading from the same cache the gallery filled. Anchors on `initialPostId` if provided. No gallery nav-target change yet — visit it via direct URL for testing.

**Files:**
- Create: `frontend/app/(logged-in)/(tabs)/(feed,search,profile)/gallery-feed/[id].tsx`

- [ ] **Step 1: Create the route file**

Write `frontend/app/(logged-in)/(tabs)/(feed,search,profile)/gallery-feed/[id].tsx`:

```tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, TouchableOpacity, SafeAreaView, ActivityIndicator } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, router, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ThemedText } from "@/components/ThemedText";
import PostCard from "@/components/cards/PostCard";
import { PostCardSkeleton } from "@/components/ui/SkeletonLoader";
import { useGalleryPostsInfinite } from "@/hooks/useGalleryPostsInfinite";
import type { Post } from "@/api/post";

type Kind = "user" | "blueprint";

export default function GalleryFeed() {
    const params = useLocalSearchParams<{ id: string; kind?: string; initialPostId?: string }>();
    const id = params.id;
    const kind: Kind = params.kind === "blueprint" ? "blueprint" : "user";
    const initialPostId = params.initialPostId;

    const ThemedColor = useThemeColor();
    const styles = stylesheet(ThemedColor);
    const navigation = useNavigation();

    const handleBack = () => {
        if (navigation.canGoBack()) router.back();
        else router.replace("/(logged-in)/(tabs)/(feed)/" as any);
    };

    const query = useGalleryPostsInfinite(kind, id);
    const posts: Post[] = query.data?.posts ?? [];

    const initialIndex = useMemo(() => {
        if (!initialPostId) return 0;
        const idx = posts.findIndex((p) => p._id === initialPostId);
        return idx >= 0 ? idx : 0;
    }, [posts, initialPostId]);

    const listRef = useRef<FlashList<Post>>(null);
    const anchoredRef = useRef(false);

    // FlashList's `initialScrollIndex` can race with item layout; this is a
    // backup that fires once after the first render that has the anchor post.
    useEffect(() => {
        if (anchoredRef.current) return;
        if (!initialPostId) {
            anchoredRef.current = true;
            return;
        }
        if (posts.length === 0) return;
        const idx = posts.findIndex((p) => p._id === initialPostId);
        if (idx < 0) {
            // Post not in current page set — let the user scroll/load to find it.
            anchoredRef.current = true;
            return;
        }
        listRef.current?.scrollToIndex({ index: idx, animated: false });
        anchoredRef.current = true;
    }, [posts, initialPostId]);

    const renderItem = ({ item }: { item: Post }) => {
        const u = item.user;
        const created = item.metadata?.createdAt
            ? Math.abs(Date.now() - new Date(item.metadata.createdAt).getTime()) / 36e5
            : 0;
        return (
            <PostCard
                icon={u.profile_picture}
                name={u.display_name}
                username={u.handle}
                userId={u._id}
                dual={item.dual}
                caption={item.caption || ""}
                time={created}
                priority="low"
                points={0}
                timeTaken={0}
                category={item.task?.category?.name}
                taskName={item.task?.content}
                reactions={
                    item.reactions && typeof item.reactions === "object"
                        ? Object.entries(item.reactions).map(([emoji, userIds]) => ({
                              emoji,
                              count: Array.isArray(userIds) ? userIds.length : 0,
                              ids: Array.isArray(userIds) ? userIds : [],
                          }))
                        : []
                }
                comments={item.comments || []}
                images={item.images || []}
                size={item.size}
                id={item._id}
            />
        );
    };

    const headerTitle = kind === "blueprint" ? "Posts" : posts[0]?.user?.handle ? posts[0].user.handle.startsWith("@") ? posts[0].user.handle : `@${posts[0].user.handle}` : "Posts";

    if (query.isPending) {
        return (
            <SafeAreaView style={styles.container}>
                <Header onBack={handleBack} title={headerTitle} ThemedColor={ThemedColor} styles={styles} />
                <View style={styles.loader}><PostCardSkeleton /></View>
            </SafeAreaView>
        );
    }

    if (posts.length === 0) {
        return (
            <SafeAreaView style={[styles.container, styles.centerContent]}>
                <Header onBack={handleBack} title={headerTitle} ThemedColor={ThemedColor} styles={styles} />
                <ThemedText style={{ color: ThemedColor.caption }}>No posts.</ThemedText>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <Header onBack={handleBack} title={headerTitle} ThemedColor={ThemedColor} styles={styles} />
            <FlashList
                ref={listRef}
                data={posts}
                keyExtractor={(item) => item._id}
                renderItem={renderItem}
                estimatedItemSize={600}
                initialScrollIndex={initialIndex}
                onEndReachedThreshold={0.5}
                onEndReached={() => {
                    if (query.hasNextPage && !query.isFetchingNextPage) {
                        query.fetchNextPage();
                    }
                }}
                ListFooterComponent={
                    query.isFetchingNextPage ? (
                        <View style={styles.footerSpinner}>
                            <ActivityIndicator size="small" color={ThemedColor.primary} />
                        </View>
                    ) : null
                }
            />
        </SafeAreaView>
    );
}

function Header({
    onBack,
    title,
    ThemedColor,
    styles,
}: {
    onBack: () => void;
    title: string;
    ThemedColor: any;
    styles: ReturnType<typeof stylesheet>;
}) {
    return (
        <View style={styles.header}>
            <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={24} color={ThemedColor.text} />
            </TouchableOpacity>
            <ThemedText style={[styles.headerTitle, { color: ThemedColor.text }]}>{title}</ThemedText>
            <View style={{ width: 24 }} />
        </View>
    );
}

const stylesheet = (ThemedColor: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: ThemedColor.background,
        },
        centerContent: {
            justifyContent: "center",
            alignItems: "center",
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: ThemedColor.tertiary,
        },
        backButton: {
            padding: 4,
        },
        headerTitle: {
            fontSize: 18,
            fontWeight: "600",
        },
        loader: {
            padding: 16,
        },
        footerSpinner: {
            paddingVertical: 16,
            alignItems: "center",
        },
    });
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && bun run tsc --noEmit 2>&1 | grep "gallery-feed" | head -20
```
Expected: empty output.

- [ ] **Step 3: Smoke test by direct URL push**

Temporarily add a debug button anywhere convenient (e.g. a `console.log` in a `useEffect` of `profile.tsx` or just type the URL in the simulator) and navigate to:
```
/(logged-in)/(tabs)/(feed,search,profile)/gallery-feed/<your-user-id>?kind=user&initialPostId=<a-post-id>
```

Verify:
1. The feed loads with the tapped post scrolled into view.
2. Scrolling down loads more posts (watch console / network for `getUserPosts` calls).
3. Scrolling up shows the earlier posts that were in the gallery cache.
4. Back button returns to where you came from.
5. With `initialPostId` omitted, the feed opens at the top.

- [ ] **Step 4: Commit**

```bash
git add "frontend/app/(logged-in)/(tabs)/(feed,search,profile)/gallery-feed/[id].tsx"
git commit -m "feat: add vertical-scrolling gallery feed route"
```

---

## Task 4: Switch `ProfileGallery` nav target to the new route

Now that the route works, point `ProfileGallery` taps and long-press "View Post" at it. Keep the rest of the file unchanged.

**Files:**
- Modify: `frontend/components/profile/ProfileGallery.tsx`

- [ ] **Step 1: Replace `handleImagePress`**

In `frontend/components/profile/ProfileGallery.tsx`, replace the current `handleImagePress` body:

```ts
const handleImagePress = (postId: string) => {
    if (postId.startsWith("legacy-")) {
        return;
    }
    const ownerId = userId || user?._id;
    if (!ownerId) {
        // Defensive: no owner context, fall back to the single-post page.
        router.push(`/(logged-in)/posting/${postId}`);
        return;
    }
    router.push(
        `/(logged-in)/(tabs)/(feed,search,profile)/gallery-feed/${ownerId}?kind=user&initialPostId=${postId}`
    );
};
```

The long-press menu's `View Post` action already calls `handleImagePress(postId)`, so it picks up the new target with no further changes.

- [ ] **Step 2: Smoke test on simulator**

1. Profile tab → tap any thumbnail → opens the feed scrolled to that post.
2. Scroll up/down in the feed to confirm pagination + anchoring.
3. Back button → returns to profile, grid unchanged.
4. Long-press a thumbnail → menu opens → tap "View Post" → opens feed at that post.
5. Long-press → "Delete Post" → confirm → post disappears from grid AND, if you re-enter the feed, the deleted post is gone there too (cache invalidation working).
6. Open someone else's profile via `account/[id]` → tap their thumbnail → feed shows their posts with the tapped one anchored.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/profile/ProfileGallery.tsx
git commit -m "feat: route ProfileGallery taps to the new gallery-feed view"
```

---

## Task 5: Switch `BlueprintGallery` nav target to the new route

`BlueprintGallery` doesn't need React-Query migration (its source endpoint is non-paginated; the hook handles the single-page case via the `kind === "blueprint"` branch). We only swap the nav target.

**Files:**
- Modify: `frontend/components/profile/BlueprintGallery.tsx`

- [ ] **Step 1: Replace `handleImagePress`**

In `frontend/components/profile/BlueprintGallery.tsx`, replace lines 76-78:

```ts
const handleImagePress = (postId: string) => {
    router.push(
        `/(logged-in)/(tabs)/(feed,search,profile)/gallery-feed/${blueprintId}?kind=blueprint&initialPostId=${postId}`
    );
};
```

- [ ] **Step 2: (Optional, decide on the fly) Pre-fill the cache**

If feed view feels sluggish to first-paint on blueprint taps because the cache is cold (the gallery currently fetches via raw `getPostsByBlueprint`, not the hook), wrap the existing `fetchBlueprintImages` to also seed the cache:

```ts
import { useQueryClient } from "@tanstack/react-query";

const queryClient = useQueryClient();

// inside fetchBlueprintImages, after `const posts = await getPostsByBlueprint(blueprintId);`:
queryClient.setQueryData(["blueprintPosts", blueprintId], {
    pages: [{ posts, hasMore: false, nextOffset: 0 }],
    pageParams: [0],
});
```

Skip this step if first-paint is fine — the feed view will fetch on its own.

- [ ] **Step 3: Smoke test on simulator**

1. Navigate to a blueprint with posts.
2. Tap a thumbnail in its gallery → feed opens, scrolled to that post.
3. Vertical scroll works in both directions within the loaded set.
4. Back → blueprint page intact.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/profile/BlueprintGallery.tsx
git commit -m "feat: route BlueprintGallery taps to the new gallery-feed view"
```

---

## Task 6: Final QA pass

This task has no code — it's an explicit verification gate before declaring the change complete.

- [ ] **Step 1: Run the full app, exercise each surface**

| Surface | Action | Expected |
|---|---|---|
| Own profile gallery | Tap thumbnail | Feed opens at that post |
| Own profile gallery | Tap top-row thumbnail | Feed opens at top of list |
| Own profile gallery | Tap bottom-row thumbnail | Feed opens scrolled down; can scroll up to see earlier posts |
| Own profile gallery | Long-press thumbnail → View Post | Same as tap |
| Own profile gallery | Long-press thumbnail → Delete Post (own post) | Post deleted, removed from grid |
| Own profile feed | Scroll to end | More posts paginate in via `fetchNextPage` |
| Friend's profile (`account/[id]`) | Tap thumbnail | Feed shows their posts, header reads `@theirhandle` |
| Blueprint page | Tap thumbnail | Feed shows blueprint's posts |
| Notification with post link | Tap | Still opens `posting/[id]` single page (unchanged) |
| Share-link / kindred://posting/* | Open | Still opens `posting/[id]` single page (unchanged) |
| PostCard kebab → Delete (from feed) | Tap | Post removed; returning to grid, deleted post not present |

- [ ] **Step 2: Run TypeScript check end-to-end**

```bash
cd frontend && bun run tsc --noEmit
```
Expected: same pre-existing errors as on main; no new errors from this branch.

- [ ] **Step 3: (Optional) Run the trivial existing test to confirm nothing broke at the harness level**

```bash
cd frontend && bun run test
```
Expected: AboutScreen test still passes.

- [ ] **Step 4: Push branch / open PR per project convention**

(Out of scope to script here — defer to user's preferred flow.)
