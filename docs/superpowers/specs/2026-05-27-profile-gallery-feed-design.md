# Profile Gallery Vertical Feed

**Date:** 2026-05-27
**Status:** Design — pending implementation
**Owner:** Abhik

## Problem

Tapping a post in the profile gallery (`ProfileGallery.tsx`) navigates to `posting/[id].tsx`, a single-post page. There is no way to browse the user's other posts without going back to the grid, tapping another thumbnail, returning, repeating. The same friction exists in `BlueprintGallery.tsx`.

Users expect Instagram-style behavior: tap a thumbnail, land on that post, scroll vertically through the rest of the user's posts.

## Goal

Replace the gallery → single-post navigation with a vertically-scrollable feed of `PostCard`s, scrolled to the tapped post on mount.

## Non-goals

- Backend pagination changes (cursor-based / `before`/`after` semantics).
- Adding an `imagesOnly` filter to the API.
- Bidirectional pagination beyond the gallery's already-loaded set (see "Bidirectional reduces to single-direction" below).
- Touching `posting/[id].tsx`. Notifications, share links, and deep links continue to use the single-post route.
- Notifications routing to the feed view.

## Design

### Route

New file: `frontend/app/(logged-in)/(tabs)/(feed,search,profile)/gallery-feed/[id].tsx`

- Path param `id`: the owner's user ID *or* the blueprint ID.
- Query param `kind`: `"user"` or `"blueprint"`.
- Query param `initialPostId`: post ID to scroll to on mount (optional; if absent, opens at top).

The route lives in the same shared group as `account/[id].tsx` and `blueprint/[id].tsx` so it inherits the same back-stack behavior across feed/search/profile tabs.

### Shared React-Query cache

Add a hook (e.g. `frontend/hooks/useGalleryPostsInfinite.ts`):

```ts
useGalleryPostsInfinite({ kind: 'user' | 'blueprint', id: string })
```

Wraps `useInfiniteQuery`:

- `kind === 'user'`: paginates `getUserPosts(id, 12, offset)`. `getNextPageParam` reads `nextOffset` and `hasMore` from the response.
- `kind === 'blueprint'`: single page via `getPostsByBlueprint(id)`. `getNextPageParam` returns `undefined` after the first page.
- Cache key: `["galleryPosts", kind, id]`.
- `select`: flatten pages and filter to posts with at least one image. This is the **only** place the image-only filter lives, so the gallery (grid) and the feed view share identical lists and indices.

`ProfileGallery` and `BlueprintGallery` migrate to read from this hook so their displayed thumbnails come from the same cache the feed will consume. When the user navigates from grid → feed, the feed mounts with full page data already in cache and renders the anchor instantly.

### Feed view component

`gallery-feed/[id].tsx` renders:

- A header bar matching `posting/[id].tsx`: back button, title (`@handle's posts` for users, blueprint name for blueprints), spacer.
- A `FlashList`:
  - `data` = flattened image-only posts from the hook.
  - `renderItem` = the existing `PostCard` component, passed the same props it gets in the main feed.
  - `initialScrollIndex` = index of `initialPostId` in `data` (or `0` if not found).
  - `estimatedItemSize` ≈ `Dimensions.get('window').width + 200` (image + chrome).
  - `onEndReached` → `fetchNextPage`.
  - Fallback: after `onLayout` of the list, if the current scroll offset is `0` but `initialPostId` was provided and is in the data, call `scrollToIndex({ animated: false })` once — guards against `initialScrollIndex` being ignored when items mount lazily.
- Loading state: spinner if the query is still in `isPending` on first mount (i.e., the user deep-linked or cache was evicted).

### Navigation change

- `ProfileGallery.handleImagePress(postId)`:
  ```
  router.push(`/(logged-in)/(tabs)/(feed,search,profile)/gallery-feed/${ownerId}?kind=user&initialPostId=${postId}`)
  ```
  where `ownerId` is the `userId` prop (or `user._id` for own profile).
- `BlueprintGallery.handleImagePress(postId)`:
  ```
  router.push(`/(logged-in)/(tabs)/(feed,search,profile)/gallery-feed/${blueprintId}?kind=blueprint&initialPostId=${postId}`)
  ```
- The long-press `View Post` option in both galleries points to the same URL.

### Delete from feed

`PostCard` already has a kebab menu with delete for the post owner. In the feed view:

- On successful delete, the feed's local list shrinks (React Query cache update via `setQueryData` removing the post from its page).
- The gallery thumbnail grid is consistent on return because both views read from the same cache.

The existing long-press menu on the grid (with `View Post` / `Delete Post`) is unchanged.

### Why bidirectional reduces to single-direction

Posts are sorted newest-first. Gallery always loads from `offset=0`. Tapping the Nth thumbnail means posts 1…N-1 are already in cache *above* the anchor. The feed view starts at index N-1 in the data array; the user scrolls down for older posts (paginate via `fetchNextPage`) or up for newer posts (already in memory, no fetch needed). There is by construction no post newer than the gallery's first page, so upward pagination is never required. This keeps the feed view a forward-only paginating list with a starting anchor.

## Blast radius

| Area | Files | Lift | Risk |
|---|---|---|---|
| New feed route | 1 new file | medium (~200 LOC) | low (greenfield) |
| New hook | 1 new file | small | low |
| `ProfileGallery.tsx` | 1 file (~460 LOC) | medium — local state → React Query, swap nav target, preserve `useImperativeHandle` (`loadMore`/`hasMore`) for parent `profile.tsx` | medium — must not regress existing gallery UX |
| `BlueprintGallery.tsx` | 1 file | small — swap nav target; data already non-paginated so RQ migration is optional, but doing it preserves cache-sharing benefits | low |
| `posting/[id].tsx` | untouched | — | — |
| Backend / Go handlers | untouched | — | — |
| OpenAPI / generated types | untouched | — | — |

## Risks and mitigations

1. **Variable `PostCard` heights with `FlashList.initialScrollIndex`.** Captions, image aspect ratios, and reactions vary row height. First-paint anchor may be off. *Mitigation*: tuned `estimatedItemSize` + one `scrollToIndex` call in `onLayout` as backup.
2. **`useImperativeHandle` surface on `ProfileGallery`.** Parent `profile.tsx` calls `loadMore()` and reads `hasMore`. *Mitigation*: keep the ref API; the implementation now proxies to RQ's `fetchNextPage` / `hasNextPage`.
3. **Cache-key alignment.** If the image-only filter drifts between gallery and feed, the anchor index lookup mis-fires. *Mitigation*: filter lives in the hook's `select` only — no consumer-side filtering.
4. **Heavy `PostCard` × tall list.** Comment bottom sheets and modals mount per row. *Mitigation*: `FlashList` recycles; measure during implementation before pre-optimizing.
5. **`initialPostId` not found in data.** Stale link, post deleted between grid-load and feed-mount. *Mitigation*: fall back to scrolling to top; do not error.

## Files touched

**New**
- `frontend/app/(logged-in)/(tabs)/(feed,search,profile)/gallery-feed/[id].tsx`
- `frontend/hooks/useGalleryPostsInfinite.ts`

**Modified**
- `frontend/components/profile/ProfileGallery.tsx` (RQ migration, nav target)
- `frontend/components/profile/BlueprintGallery.tsx` (nav target; optional RQ migration)
- Possibly `frontend/app/(logged-in)/(tabs)/(profile)/profile.tsx` if the `useImperativeHandle` shim is too awkward (preferably no change)

**Untouched**
- `frontend/app/(logged-in)/posting/[id].tsx`
- `frontend/api/post.ts` (functions stay; new hook wraps them)
- All backend code
