# Discover People Page

**Date:** 2026-06-05
**Status:** Approved design — pending implementation plan

## Problem

The search screen shows a horizontal "Suggested Users" carousel (`SuggestedUsers`,
rendering `ContactCard`s). There's no way to browse the full set of users on Kindred. Add
a "See more" entry point that opens a page listing all users in a 2-column grid using the
same card.

## Scope decisions

- **No pagination** (deferred): the page fetches the full user list once via the existing
  `getAllProfiles()` and renders all of it. A paginated backend endpoint is the eventual
  answer but is out of scope here.
- **Exclude only the current user** from the grid. Existing friends/follows are still
  shown. No following-status badge on the cards (deferred).

## Components & files

### `components/search/SuggestedUsers.tsx` (modify)

- Add prop `onSeeMore?: () => void`.
- When provided, render a right-aligned **"See more"** pressable next to the "Suggested
  Users" header (same pattern as `FollowRequestsSection`'s "see all"). Header row becomes
  a space-between row: title on the left, "See more" on the right.

### `app/(logged-in)/(tabs)/(search)/search.tsx` (modify)

- Pass `onSeeMore={() => router.push("/(logged-in)/(tabs)/(search)/discover")}` to
  `SuggestedUsers`.

### `app/(logged-in)/(tabs)/(search)/discover.tsx` (new route)

Pushed within the `(search)` stack (shared `(feed,search,profile)` layout gives it the
standard slide-in + back gesture).

- **Header:** back chevron + "Discover People" title (match the header pattern used by
  other `(search)`/profile sub-screens).
- **Data:** TanStack Query — `useQuery({ queryKey: ["allProfiles"], queryFn: getAllProfiles })`.
  Filter out the current user via `useAuth().user._id`.
- **Grid:** `FlashList` with `numColumns={2}`, horizontal screen padding and an
  inter-column gap. Each cell renders `ContactCard` mapped from `ProfileDocument`
  (`name=display_name`, `icon=profile_picture`, `handle=handle`, `id=_id`,
  `following={false}`), sized to the computed column width.
- **States:** loading spinner/skeleton; "No users found" empty state; error state with a
  retry, consistent with the search screen.

### `components/cards/ContactCard.tsx` (modify)

- Add optional prop `width?: number`, defaulting to the current `125`. The container style
  uses this width so the card can fill a grid column. Backward-compatible — the carousel
  usage is unchanged.

## Data flow

```
discover.tsx
  └─ useQuery(["allProfiles"], getAllProfiles)  ->  ProfileDocument[]
       └─ filter(p => p._id !== currentUserId)
            └─ FlashList numColumns=2
                 └─ ContactCard (width = column width)  -> tap -> /account/{id}
```

Column width: `(screenWidth - horizontalPadding*2 - columnGap) / 2`.

## Out of scope (YAGNI / per user)

- Pagination / infinite scroll.
- Excluding existing friends/follows.
- Following-status indicator on cards.
- Search/filter within the Discover page (search already exists on the parent screen).

## Risks / watch-items

- `getAllProfiles()` downloads every profile at once; acceptable at current scale, revisit
  with a paginated endpoint as the user base grows.
- `ContactCard` is an image card with a fixed aspect; confirm it looks right at the wider
  grid-column width (vs. the 125px carousel width).
