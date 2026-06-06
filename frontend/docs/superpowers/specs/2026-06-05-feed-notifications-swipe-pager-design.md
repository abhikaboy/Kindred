# Feed ↔ Notifications Swipe Pager

**Date:** 2026-06-05
**Status:** Approved design — pending implementation plan

## Problem

The feed and notifications are connected by a swipe gesture that `router.push`es the
Notifications route. This has two flaws the user hit:

1. The pushed Notifications screen persists as the Feed tab's top screen, so re-entering
   the tab lands on Notifications instead of the feed.
2. There is no live preview of the other side during the swipe — it is a discrete push,
   not an Instagram/DM-style interactive transition.

The user wants an Instagram-style horizontal pager between the feed and notifications: the
other side previews proportionally as you drag, and releasing settles on a page.

## Approach

Render the feed and notifications as the two pages of a horizontal `PagerView`
(`react-native-pager-view`, v8.0.0 — already a dependency and the same component
`components/daily/DatePager.tsx` uses). `PagerView` provides the native mid-swipe preview
and finger-tracking for free, so no hand-rolled reanimated drag is needed (an earlier
hand-rolled `translateX` attempt was reverted in commit `30b7a91` for a mount hitch).

### Page layout

- **Page 0 (default, left):** the existing feed — animated header + `FlatList`.
- **Page 1 (right):** `<NotificationsView>`, lazily mounted.

Swiping left from the feed reveals notifications (DM convention); swiping right returns.

## Components

### `components/notifications/NotificationsView.tsx` (new)

The body of the current `Notifications.tsx` screen is extracted into a reusable component
holding all existing behavior: the internal For You / Activity / Requests tabs, the
section lists, data fetching (`useNotifications`, `useForYou`), the
`InteractionManager` ready gate, and mark-all-as-read.

Props:

- `isActive: boolean` — whether the notifications page is currently the visible page.
- `onBack: () => void` — invoked by the header back-arrow.

### `app/(logged-in)/(tabs)/(feed)/Notifications.tsx` (standalone route — kept)

Becomes a thin wrapper preserving deep links and push-notification targets:

```tsx
<NotificationsView isActive onBack={() => router.dismissTo("/(logged-in)/(tabs)/(feed)/feed")} />
```

Internal pushes that already fire from inside notifications (post/task detail, kudos,
settings) continue to use `router.push`/`router.navigate` and work unchanged, because the
pager lives inside the `(feed)` stack.

### `app/(logged-in)/(tabs)/(feed)/feed.tsx` (host)

- Wraps page 0 (existing header + `FlatList`) and page 1 (`<NotificationsView>`) in a
  `PagerView` with `initialPage={0}`.
- Removes the `swipeToNotifications` `Gesture` and its `GestureDetector` wrapper — the
  pager owns horizontal swipe.
- Holds a `pagerRef` and the page-state described below.

## Data flow & state

- **`activePage` (0 | 1):** updated in `onPageSelected`. Drives `isActive` passed to
  `NotificationsView` (`activePage === 1`).
- **`notificationsMounted` (boolean):** starts `false`. Page 1 renders a lightweight
  skeleton placeholder. On the first swipe begin (PagerView scroll state → `dragging`, via
  `onPageScrollStateChanged`), set `true`. Once `true`, stays mounted — first peek shows a
  brief skeleton, every subsequent swipe is instant.
- **Mark-as-read trigger change:** today it runs on route `useFocusEffect`. Inside the
  pager that would mis-fire while the feed page is showing. It is re-driven by `isActive`
  becoming `true` (notifications page selected), keeping the existing "at most once per
  activation, only if unread" guard.

## Navigation entry points

| Entry point | Before | After |
|---|---|---|
| Feed header heart button (`feed.tsx:728`) | `router.push(Notifications)` | `pagerRef.current?.setPage(1)` |
| Other feed push (`feed.tsx:599`) | `router.push(Notifications)` | `pagerRef.current?.setPage(1)` |
| Notifications header back-arrow | `router.back()` | `onBack()` → `setPage(0)` in pager / `dismissTo(feed)` in standalone route |

## Behavior preserved

- Feed scroll-hide tab-bar logic unchanged on page 0; tab bar stays visible on page 1.
- Feed pull-to-refresh and pagination unchanged (still inside page 0's `FlatList`).
- Vertical `FlatList` scroll and horizontal pager swipe compose natively.
- Deep links / push taps to the standalone Notifications route still work.

## Out of scope (YAGNI)

- No hand-rolled reanimated drag — PagerView's native preview is the desired effect.
- Notifications' internal tab structure (For You / Activity / Requests) is untouched.
- No change to notification data models, APIs, or the badge.

## Risks / watch-items

- **Mark-as-read correctness:** must move cleanly from focus-driven to `isActive`-driven
  without double-firing or spamming requests (the existing ref-guard pattern must be
  carried over carefully).
- **Lazy skeleton during preview:** the first leftward peek shows a skeleton, not content —
  accepted per the lazy-mount decision.
- **Two `NotificationsView` instances** (pager page + standalone route) never mount
  simultaneously, so the `useNotifications` hook is not double-active.
