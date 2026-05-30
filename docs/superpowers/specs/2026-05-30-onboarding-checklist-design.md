# Onboarding Checklist (Replace Spotlight Tour)

**Status:** Draft
**Date:** 2026-05-30
**Owner:** @abhik

## Goal

Replace the existing spotlight-tour onboarding flow with an inline, dismissible checklist that lives on the home screen and is driven by automatically-detected user behavior. The pattern is modeled on Google Health's "Welcome — let's get you set up" card: a short list of milestone actions that auto-check themselves as the user does each one, paired with a tiny celebratory toast on each transition.

The spotlight tour is being removed entirely. The library `react-native-spotlight-tour`, the `SpotlightContext`, and every `AttachStep`/`SpotlightTourProvider`/`useSpotlightTour` site are deleted.

## Visible behavior

A new card sits on the home screen between `DashboardStats` and `WorkingOnRow`. It shows up to three uncompleted onboarding items at a time, with a slim purple progress bar, an "X of 4" counter, and a small "Dismiss" link. Tapping a row deep-links the user into the action the row describes. Each item auto-checks itself the moment the user does the action that satisfies it, with a one-line celebratory toast.

Visual treatment matches Option B from the brainstorm mockup: gradient purple-tinted background, Fraunces title, slim 4px progress bar, Outfit row labels, chevron affordances, subtle "Dismiss" text link in the bottom-right.

## Items

Priority order (low number = higher priority):

| # | Label | Completes when |
|---|---|---|
| 1 | Make your first task | `user.tasks_complete > 0` |
| 2 | Send your first kudos | `user.encouragements + user.congratulations > 0` |
| 3 | Add a friend | `user.friends.length > 0` |
| 4 | Close all 3 rings in a day | `user.first_all_rings_closed_at != null` |

### Visible-rows rule

Show the top-3 uncompleted items by priority order, with one gate: **item #4 (rings) is hidden until item #1 (first task) is complete.** This prevents the card from nagging about rings before the user has even created their first task.

Worked examples:

- Brand-new user (0/4 done): visible = [task, kudos, friend]. Rings hidden by gate.
- After first task: visible = [kudos, friend, rings].
- After task + kudos: visible = [friend, rings].
- After task + friend (kudos still pending): visible = [kudos, rings].
- After kudos + friend but no task: visible = [task]. Just one row, because rings is still gated.
- All 4 done: card hides.

### Card visibility rule

```
show = !dismissed && (any of the 4 items is uncompleted)
```

Returning users who already satisfy all 4 items never see the card. Users who complete the last remaining item see the card auto-disappear on the next render.

## Row tap destinations

- **Make your first task** → `openModal()` from `useCreateModal()` to launch the create-task sheet.
- **Send your first kudos** → scroll the home `ScrollView` to the Kudos section on the same screen (Kudos cards are visible just below). Implementation: pass a ref or use `scrollRef.current?.scrollTo({ y: kudosOffset })`.
- **Add a friend** → `router.push("/(logged-in)/(tabs)/(search)/search")`.
- **Close all 3 rings in a day** → `router.push` to whichever route currently hosts the `ProductivityRings` detail view. (Today: the profile tab. Confirm exact route during implementation.)

## Auto-detection + toast

On home-screen mount, the checklist component reads a snapshot of the four completion flags from AsyncStorage. On each re-render (driven by `user` context changes), it computes the current flag set and diffs against the snapshot.

- If a flag transitions `false → true`, fire a `showToastable` (using the existing `DefaultToast`) with a short message: e.g., "Nice — first task done. One down, two to go." Then update the snapshot.
- If no transitions, do nothing.
- If a flag is true on first-ever mount (pre-existing user state), it is recorded into the snapshot silently — no toast.

This keeps the auto-detection mechanism decoupled from the individual action sites (task creation, kudos send, friend add, ring close) — no callback wiring needed at those sites.

Toast copy (initial):
1. Task: "Nice — first task done. Keep going."
2. Kudos: "First kudos sent. Spread the love."
3. Friend: "Friend added. You're not alone in this."
4. Rings: "All three rings closed. That's the move."

## Storage

| Key | Scope | Purpose |
|---|---|---|
| `${userId}-onboarding-checklist-dismissed` | AsyncStorage | Whether the user has tapped "Dismiss". Per-device by design. |
| `${userId}-onboarding-checklist-snapshot` | AsyncStorage | Last-seen `{task, kudos, friend, rings}` boolean snapshot, used only for diff-firing toasts. |

Both are scoped by `userId` to avoid cross-account collisions on shared devices.

## Backend change

One new optional field on the `User` (`SafeUser`) document and OpenAPI schema:

```go
FirstAllRingsClosedAt *time.Time `bson:"first_all_rings_closed_at,omitempty" json:"first_all_rings_closed_at,omitempty"`
```

Set inside `backend/internal/handlers/rings/service.go`, in the branch where `justClosedAll := allClosed && !wasPreviouslyAllClosed` is true (around line 159 today). When this branch fires, also call into the users collection to set `first_all_rings_closed_at` to `time.Now()`, gated on the field not already being set. Idempotent and atomic via `$set` + `$exists: false` filter on the update.

No backfill needed. Existing users who close their rings the next day will have the field set then.

Generated TypeScript types will pick up the new field automatically; the checklist treats `null`/`undefined` as "not yet closed".

## Files

### Removed
- `frontend/contexts/SpotlightContext.tsx`
- `frontend/components/spotlight/TourStepCard.tsx`
- `frontend/components/spotlight/` (directory becomes empty — delete it)
- `frontend/constants/spotlightConfig.ts`: remove `SPOTLIGHT_MOTION`. Keep `ONBOARDING_WORKSPACE` (still used by `app/(onboarding)/tutorial.tsx`).
- `react-native-spotlight-tour` from `frontend/package.json` + `bun.lockb`.

### Modified
- `frontend/app/_layout.tsx` — remove `<SpotlightProvider>` wrapper and the `SpotlightProvider` import.
- `frontend/app/(logged-in)/(tabs)/(task)/index.tsx` — strip `SpotlightTourProvider`, `TourStep`, `useSpotlightTour`, `useSpotlight`, `AttachStep` usages and tour-step JSX. Remove `setSpotlightShown`/`skipAllSpotlights` calls.
- `frontend/app/(logged-in)/(tabs)/(task)/workspace.tsx` — same removal.
- `frontend/components/home/Drawer.tsx` — same removal.
- `frontend/components/modals/create/Standard.tsx` — same removal.
- `frontend/components/dashboard/HomescrollContent.tsx` —
  - Remove `AttachStep` imports and wrappers around Jump Back In and Kudos sections.
  - Remove `onSpotlightLayout`, `jumpBackInRef`, `handleJumpLayout`, `handleKudosLayout` props/handlers used only by spotlight. Keep `kudosRef` and the kudos-section `onLayout` capture — the new checklist needs the kudos section's `y` offset for the "Send your first kudos" row tap, which scrolls the user to that section.
  - Insert `<OnboardingChecklist scrollRef={scrollRef} kudosRef={kudosRef} />` between `<DashboardStats />` and `<WorkingOnRow />`.
- Backend ring-close handler (path TBD during implementation; likely `backend/internal/handlers/rings/`): add the `FirstAllRingsClosedAt` set-once logic.
- Backend `SafeUser` schema: add `FirstAllRingsClosedAt` field.

### Added
- `frontend/components/dashboard/OnboardingChecklist.tsx` — the new card component. Self-contained: reads `user` from `useAuth`, reads/writes its two AsyncStorage keys, computes visible rows, renders the card, fires toasts on transitions, handles tap destinations.

## Component shape

```tsx
// components/dashboard/OnboardingChecklist.tsx
type ItemKey = 'task' | 'kudos' | 'friend' | 'rings';
type CompletionMap = Record<ItemKey, boolean>;

interface OnboardingChecklistProps {
  scrollRef: React.RefObject<ScrollView>;
  kudosRef: React.RefObject<View>;
}
```

Internals:
- `useAuth()` → user object
- `useCreateModal()` → for task row tap
- `useRouter()` → for friend / rings row tap
- AsyncStorage read on mount (snapshot + dismissed flag), AsyncStorage write on completion transitions and on Dismiss tap
- Memoized `completion: CompletionMap` derived from user fields
- `visibleItems = computeVisibleItems(completion)` — implements the priority + rings-gate rule
- `useEffect(diff snapshot → completion)` fires toasts via `showToastable`

Keep the file under ~250 lines. If row rendering grows, extract a `ChecklistRow` subcomponent in the same file.

## Open questions

- Exact route for "Close all 3 rings" tap destination: `ProductivityRings` is mounted in the profile tab today. Confirm during implementation whether to deep-link to the profile tab or to a dedicated rings detail view if one exists.

## Out of scope

- Re-introducing a card after dismissal.
- Server-side dismissal storage (cross-device dismissal).
- Backfilling `first_all_rings_closed_at` for users who closed rings before this feature ships.
- Tutorial workspace cleanup (the `🌺 Kindred Guide` workspace from `ONBOARDING_WORKSPACE` stays in place — separate concern).
- Re-engagement of users whose card auto-hid because they completed all items (no celebratory "you're all set" screen).
