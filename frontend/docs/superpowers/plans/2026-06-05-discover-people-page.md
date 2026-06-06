# Discover People Page — Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a "See more" link to Suggested Users that opens a new "Discover People" page showing all users (minus yourself) in a 2-column grid of the existing `ContactCard`.

**Architecture:** New `(search)/discover` route fetches `getAllProfiles()` via TanStack Query, filters out the current user, and renders a `FlatList numColumns={2}` of `ContactCard`s sized to the column width. `ContactCard` gains an optional `width` prop. `SuggestedUsers` gains an `onSeeMore` callback that search.tsx wires to a `router.push`.

**Tech Stack:** React Native, expo-router, @tanstack/react-query, existing `getAllProfiles`, `ContactCard`.

**Testing note:** RN screen work, no component-test harness. Verification is `bun run tsc` + manual run.

---

### Task 1: `ContactCard` optional width

**Files:** Modify `components/cards/ContactCard.tsx`

- [ ] **Step 1:** Add `width?: number` to `Props`.
- [ ] **Step 2:** Destructure `width` and override the container style so a grid can size it (and drop the carousel's right margin when widthed):
  `style={[styles.container, width != null && { width, marginRight: 0 }]}`
- [ ] **Step 3:** `bun run tsc` — clean.

### Task 2: `SuggestedUsers` "See more"

**Files:** Modify `components/search/SuggestedUsers.tsx`

- [ ] **Step 1:** Add `onSeeMore?: () => void` to `SuggestedUsersProps` (and the memo comparator stays keyed on `users`).
- [ ] **Step 2:** Replace the header `ThemedText` with a space-between row: the "Suggested Users" title on the left and, when `onSeeMore` is set, a right-aligned `Pressable` "See more" (`type="caption"`, `color: ThemedColor.primary`) calling `onSeeMore`.
- [ ] **Step 3:** `bun run tsc` — clean.

### Task 3: Discover route

**Files:** Create `app/(logged-in)/(tabs)/(search)/discover.tsx`

- [ ] **Step 1:** Build the screen:
  - `useQuery({ queryKey: ["allProfiles"], queryFn: getAllProfiles })`.
  - `const currentUserId = useAuth().user?._id;` filter `data` to `p._id !== currentUserId`.
  - Header: back chevron (`router.back()`) + "Discover People" title.
  - `FlatList` `numColumns={2}`, `columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}`, `contentContainerStyle={{ gap: 12, paddingBottom: <inset/sane> }}`, `keyExtractor={p => p._id}`.
  - `renderItem`: `<ContactCard width={cardWidth} name={p.display_name} icon={p.profile_picture} handle={p.handle} id={p._id} following={false} />` where `cardWidth = (Dimensions.get("window").width - 32 - 12) / 2`.
  - Loading → centered `ActivityIndicator`; empty → "No users found"; error → message + retry (`refetch`).
- [ ] **Step 2:** `bun run tsc` — clean (route type for `/(logged-in)/(tabs)/(search)/discover` is generated).

### Task 4: Wire the entry point

**Files:** Modify `app/(logged-in)/(tabs)/(search)/search.tsx`

- [ ] **Step 1:** Pass `onSeeMore={() => router.push("/(logged-in)/(tabs)/(search)/discover")}` to `<SuggestedUsers ... />`.
- [ ] **Step 2:** `bun run tsc` whole project — only the pre-existing `DatePager` errors remain.

### Task 5: Verify & commit

- [ ] **Step 1:** Stage the four touched/created files + this plan; commit.
- [ ] **Step 2:** Offer to run the app to confirm the grid + "See more".
