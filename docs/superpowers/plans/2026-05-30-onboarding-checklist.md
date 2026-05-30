# Onboarding Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the spotlight tour with an inline 3-of-4 onboarding checklist on the home screen that auto-detects progress from user stats.

**Architecture:** A new self-contained `OnboardingChecklist` component sits between Dashboard Stats and Working On rows. It reads completion state from existing user fields (`tasks_complete`, `encouragements + congratulations`, `friends.length`) plus one new backend field (`first_all_rings_closed_at`). Visible-row logic is a pure function with unit tests. Toast-on-transition uses an AsyncStorage snapshot diff. Dismissal is per-device (AsyncStorage). All `react-native-spotlight-tour` infrastructure is deleted.

**Tech Stack:** React Native + Expo, AsyncStorage, react-native-toastable, Go (Huma + MongoDB), Jest + jest-expo, Go testify suite.

**Spec:** `docs/superpowers/specs/2026-05-30-onboarding-checklist-design.md`

---

## Task 1: Add `FirstAllRingsClosedAt` field to backend `User` and `SafeUser`

**Files:**
- Modify: `backend/internal/handlers/types/types.go:236-294`

- [ ] **Step 1: Add the field to `User` struct**

In `backend/internal/handlers/types/types.go` insert this line in the `User` struct (after `TermsVersion`, before the closing brace at line 270):

```go
	FirstAllRingsClosedAt *time.Time   `bson:"first_all_rings_closed_at,omitempty" json:"first_all_rings_closed_at,omitempty"`
```

- [ ] **Step 2: Add the same field to `SafeUser` struct**

In the same file, add the same line to `SafeUser` (after `TermsVersion`, before the closing brace at line 294):

```go
	FirstAllRingsClosedAt *time.Time           `bson:"first_all_rings_closed_at,omitempty" json:"first_all_rings_closed_at,omitempty"`
```

- [ ] **Step 3: Build the backend**

Run from `backend/`:

```bash
cd /Users/abhik.ray/Kindred/backend && go build ./...
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/abhik.ray/Kindred && git add backend/internal/handlers/types/types.go && git commit -m "feat(backend): add first_all_rings_closed_at to user model"
```

---

## Task 2: Write a failing test for set-once `FirstAllRingsClosedAt` behavior

**Files:**
- Modify: `backend/internal/handlers/rings/service_test.go`

- [ ] **Step 1: Add a new test function in the `// AllRingsClose Tests` section**

In `backend/internal/handlers/rings/service_test.go`, after the existing `TestAllRingsClose` function (line 176), add:

```go
func (s *RingServiceTestSuite) TestAllRingsClose_SetsFirstAllRingsClosedAtOnce() {
	user := s.GetUser(0)
	ctx := context.Background()

	// Close all three rings to trigger JustClosedAll.
	for i := 0; i < DefaultPlanTarget; i++ {
		_, _, err := s.service.IncrementRing(ctx, user.ID, "UTC", RingPlan)
		s.NoError(err)
	}
	for i := 0; i < DefaultDoTarget; i++ {
		_, _, err := s.service.IncrementRing(ctx, user.ID, "UTC", RingDo)
		s.NoError(err)
	}
	_, delta, err := s.service.IncrementRing(ctx, user.ID, "UTC", RingShare)
	s.NoError(err)
	s.True(delta.JustClosedAll)

	// Field should now be set.
	var refreshed types.User
	err = s.users.FindOne(ctx, bson.M{"_id": user.ID}).Decode(&refreshed)
	s.NoError(err)
	s.NotNil(refreshed.FirstAllRingsClosedAt, "first_all_rings_closed_at should be set after closing all rings")
	firstClose := *refreshed.FirstAllRingsClosedAt

	// Increment Share again on a separately closed-all day shouldn't change the field.
	// Simulate by manually re-running the set logic in the same day; field should
	// remain the original timestamp (set-once semantics).
	time.Sleep(10 * time.Millisecond)
	_, _, err = s.service.IncrementRing(ctx, user.ID, "UTC", RingShare)
	s.NoError(err)

	err = s.users.FindOne(ctx, bson.M{"_id": user.ID}).Decode(&refreshed)
	s.NoError(err)
	s.NotNil(refreshed.FirstAllRingsClosedAt)
	s.Equal(firstClose, *refreshed.FirstAllRingsClosedAt, "first_all_rings_closed_at must not change on subsequent closures")
}
```

Add these imports to the top of the file if not already present:

```go
"time"
"github.com/abhikaboy/Kindred/internal/handlers/types"
```

- [ ] **Step 2: Run the new test to verify it fails**

Run:

```bash
cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/rings/ -run TestRingServiceTestSuite/TestAllRingsClose_SetsFirstAllRingsClosedAtOnce -v
```

Expected: FAIL with `first_all_rings_closed_at should be set after closing all rings` because the field is `nil`.

- [ ] **Step 3: Commit the failing test**

```bash
cd /Users/abhik.ray/Kindred && git add backend/internal/handlers/rings/service_test.go && git commit -m "test(rings): expect first_all_rings_closed_at to be set on first all-close"
```

---

## Task 3: Implement set-once `FirstAllRingsClosedAt` in ring service

**Files:**
- Modify: `backend/internal/handlers/rings/service.go:158-178`

- [ ] **Step 1: Add the set-once update inside `IncrementRing`**

In `backend/internal/handlers/rings/service.go`, locate the block starting around line 158:

```go
	wasPreviouslyAllClosed := state.AllClosed
	justClosedAll := allClosed && !wasPreviouslyAllClosed
```

After the `FindOneAndUpdate` for `closureUpdate` (around line 175), but before `recalculateScore`, add:

```go
	// First-ever all-closed: set the milestone timestamp on the user document.
	// Guarded by $exists:false so it's only set once and is idempotent.
	if justClosedAll && s.users != nil {
		_, _ = s.users.UpdateOne(ctx,
			bson.M{"_id": userID, "first_all_rings_closed_at": bson.M{"$exists": false}},
			bson.M{"$set": bson.M{"first_all_rings_closed_at": now}},
		)
	}
```

- [ ] **Step 2: Run the failing test to verify it passes**

Run:

```bash
cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/rings/ -run TestRingServiceTestSuite/TestAllRingsClose_SetsFirstAllRingsClosedAtOnce -v
```

Expected: PASS.

- [ ] **Step 3: Run the full ring test suite to confirm nothing else broke**

Run:

```bash
cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/rings/ -v
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
cd /Users/abhik.ray/Kindred && git add backend/internal/handlers/rings/service.go && git commit -m "feat(rings): set first_all_rings_closed_at on first all-close"
```

---

## Task 4: Regenerate OpenAPI spec and frontend types

**Files:**
- Modify: `frontend/api/api-spec.yaml`
- Modify: `frontend/api/generated/types.ts`

- [ ] **Step 1: Regenerate the backend OpenAPI spec**

Run:

```bash
cd /Users/abhik.ray/Kindred/backend && go run ./cmd/server --generate-openapi --openapi-output ../frontend/api/api-spec.yaml
```

The `--generate-openapi` flag makes the server emit the spec and exit (see `backend/cmd/server/main.go:43`).

Expected: `frontend/api/api-spec.yaml` updated with `first_all_rings_closed_at` appearing under `SafeUser`.

- [ ] **Step 2: Regenerate TypeScript types**

Run:

```bash
cd /Users/abhik.ray/Kindred/frontend && bun generate-types
```

Expected: `frontend/api/generated/types.ts` updated. Grep to confirm:

```bash
grep first_all_rings_closed_at /Users/abhik.ray/Kindred/frontend/api/generated/types.ts
```

Expected: at least one match inside the `SafeUser` schema.

- [ ] **Step 3: Commit**

```bash
cd /Users/abhik.ray/Kindred && git add frontend/api/api-spec.yaml frontend/api/generated/types.ts && git commit -m "chore: regenerate API types for first_all_rings_closed_at"
```

---

## Task 5: Remove `SpotlightProvider` from root layout

**Files:**
- Modify: `frontend/app/_layout.tsx:26, 165, 200`

- [ ] **Step 1: Remove the import line**

In `frontend/app/_layout.tsx`, delete the line:

```tsx
import { SpotlightProvider } from "@/contexts/SpotlightContext";
```

- [ ] **Step 2: Remove the wrapper**

Replace the `<SpotlightProvider>...</SpotlightProvider>` wrapper with its inner children directly. Use the Read tool to see the current shape of the JSX, then unwrap. Result: the children of `<SpotlightProvider>` become direct children of whatever previously wrapped it.

- [ ] **Step 3: Type-check the file**

Run:

```bash
cd /Users/abhik.ray/Kindred/frontend && bunx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "_layout\|SpotlightProvider" | head -20
```

Expected: no errors referencing `SpotlightProvider` in `_layout.tsx`.

- [ ] **Step 4: Commit**

```bash
cd /Users/abhik.ray/Kindred && git add frontend/app/_layout.tsx && git commit -m "refactor: remove SpotlightProvider from root layout"
```

---

## Task 6: Strip spotlight from `(task)/index.tsx`

**Files:**
- Modify: `frontend/app/(logged-in)/(tabs)/(task)/index.tsx`

- [ ] **Step 1: Remove spotlight imports and usage**

In `frontend/app/(logged-in)/(tabs)/(task)/index.tsx`:

1. Delete imports:
   ```tsx
   import { SpotlightTourProvider, TourStep, useSpotlightTour } from "react-native-spotlight-tour";
   import { useSpotlight } from "@/contexts/SpotlightContext";
   ```
2. Delete the `useSpotlight()` destructure (line 66) and any references to `spotlightState`, `setSpotlightShown`, `skipAllSpotlights`, `spotlightLoading` in this file.
3. Delete any `<SpotlightTourProvider>`, `<TourStep>`, `<AttachStep>` JSX wrappers — keep their children intact.
4. Delete any internal component that exists only to call `useSpotlightTour()` and `start()` (around line 322 and surrounding helpers).
5. Delete any `setSpotlightShown("homeSpotlight")` calls.

- [ ] **Step 2: Type-check**

```bash
cd /Users/abhik.ray/Kindred/frontend && bunx tsc --noEmit -p tsconfig.json 2>&1 | grep "app/(logged-in)/(tabs)/(task)/index.tsx" | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/abhik.ray/Kindred && git add "frontend/app/(logged-in)/(tabs)/(task)/index.tsx" && git commit -m "refactor: strip spotlight tour from home task screen"
```

---

## Task 7: Strip spotlight from `(task)/workspace.tsx`

**Files:**
- Modify: `frontend/app/(logged-in)/(tabs)/(task)/workspace.tsx`

- [ ] **Step 1: Apply the same removal pattern as Task 6**

In `frontend/app/(logged-in)/(tabs)/(task)/workspace.tsx`:

1. Delete imports:
   ```tsx
   import { SpotlightTourProvider, TourStep, useSpotlightTour, AttachStep } from "react-native-spotlight-tour";
   import { useSpotlight } from "@/contexts/SpotlightContext";
   ```
2. Delete the `useSpotlight()` destructure (line 45) and references to its return values.
3. Unwrap all `<SpotlightTourProvider>`, `<TourStep>`, `<AttachStep>` JSX while preserving their children.
4. Delete `setSpotlightShown("workspaceSpotlight")` and any helper subcomponent that uses `useSpotlightTour().start()` (around line 197).

- [ ] **Step 2: Type-check**

```bash
cd /Users/abhik.ray/Kindred/frontend && bunx tsc --noEmit -p tsconfig.json 2>&1 | grep "workspace.tsx" | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/abhik.ray/Kindred && git add "frontend/app/(logged-in)/(tabs)/(task)/workspace.tsx" && git commit -m "refactor: strip spotlight tour from workspace screen"
```

---

## Task 8: Strip spotlight from `Drawer.tsx`

**Files:**
- Modify: `frontend/components/home/Drawer.tsx`

- [ ] **Step 1: Same removal pattern**

In `frontend/components/home/Drawer.tsx`:

1. Delete imports:
   ```tsx
   import { SpotlightTourProvider, TourStep, useSpotlightTour, AttachStep } from "react-native-spotlight-tour";
   import { useSpotlight } from "@/contexts/SpotlightContext";
   ```
2. Delete the `useSpotlight()` destructure (line 46) and references.
3. Unwrap all spotlight JSX wrappers (`SpotlightTourProvider`, `TourStep`, `AttachStep`) while preserving children.
4. Delete `setSpotlightShown("menuSpotlight")` and the helper subcomponent using `start()` (around line 151).

- [ ] **Step 2: Type-check**

```bash
cd /Users/abhik.ray/Kindred/frontend && bunx tsc --noEmit -p tsconfig.json 2>&1 | grep "Drawer.tsx" | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/abhik.ray/Kindred && git add frontend/components/home/Drawer.tsx && git commit -m "refactor: strip spotlight tour from drawer"
```

---

## Task 9: Strip spotlight from `Standard.tsx` (create modal)

**Files:**
- Modify: `frontend/components/modals/create/Standard.tsx`

- [ ] **Step 1: Same removal pattern**

In `frontend/components/modals/create/Standard.tsx`:

1. Delete imports:
   ```tsx
   import { SpotlightTourProvider, TourStep, useSpotlightTour, AttachStep, hide } from "react-native-spotlight-tour";
   import { useSpotlight } from "@/contexts/SpotlightContext";
   ```
2. Delete the `useSpotlight()` destructure (line 50) and references.
3. Unwrap all spotlight JSX wrappers while preserving children.
4. Delete `setSpotlightShown("taskSpotlight")` and the helper subcomponent at line 162.

- [ ] **Step 2: Type-check**

```bash
cd /Users/abhik.ray/Kindred/frontend && bunx tsc --noEmit -p tsconfig.json 2>&1 | grep "Standard.tsx" | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/abhik.ray/Kindred && git add frontend/components/modals/create/Standard.tsx && git commit -m "refactor: strip spotlight tour from create modal"
```

---

## Task 10: Strip spotlight from `HomescrollContent.tsx` while preserving scroll refs

**Files:**
- Modify: `frontend/components/dashboard/HomescrollContent.tsx`

- [ ] **Step 1: Remove spotlight import and props**

In `frontend/components/dashboard/HomescrollContent.tsx`:

1. Delete the import:
   ```tsx
   import { AttachStep } from "react-native-spotlight-tour";
   ```
2. From the `HomeScrollContentProps` interface, delete:
   - `jumpBackInRef`
   - `onSpotlightLayout`
3. From the component destructure, drop `jumpBackInRef` and `onSpotlightLayout`.
4. Delete `handleJumpLayout` (lines 309-313).
5. Keep `handleKudosLayout` and `kudosRef` — they're still needed for the checklist's "Send your first kudos" deep-scroll. But change the signature of `onSpotlightLayout` to a more honest name `onKudosLayout` and update the prop accordingly. **Result:**

   ```tsx
   onKudosLayout?: (layout: { y: number; height: number }) => void;
   ```

   And:

   ```tsx
   const handleKudosLayout = (event: any) => {
       if (!onKudosLayout) return;
       const { y, height } = event.nativeEvent.layout;
       onKudosLayout({ y, height });
   };
   ```

6. Unwrap the `<AttachStep>` around the `JUMP BACK IN` section header — keep the inner `<View ref={jumpBackInRef} onLayout={handleJumpLayout}>` deleted entirely (since both ref and handler are gone).
7. Unwrap the `<AttachStep index={1}>` around `<KudosCards />`, keeping the inner `<View ref={kudosRef} onLayout={handleKudosLayout}>` wrapper.

- [ ] **Step 2: Update the parent that passes these props**

The parent is `frontend/app/(logged-in)/(tabs)/(task)/index.tsx` — already touched in Task 6. Confirm it no longer passes `jumpBackInRef` or `onSpotlightLayout` (those were tied to spotlight). Have it pass `kudosRef={kudosRef}` and `onKudosLayout={(layout) => kudosOffsetRef.current = layout.y}` to capture the y-offset for later scroll-to.

If `index.tsx` doesn't already keep a `kudosOffsetRef`, add it:

```tsx
const kudosOffsetRef = useRef<number>(0);
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/abhik.ray/Kindred/frontend && bunx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "HomescrollContent|index.tsx" | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/abhik.ray/Kindred && git add frontend/components/dashboard/HomescrollContent.tsx "frontend/app/(logged-in)/(tabs)/(task)/index.tsx" && git commit -m "refactor: strip spotlight wrappers from home, keep kudos layout capture"
```

---

## Task 11: Delete unused spotlight files and constants

**Files:**
- Delete: `frontend/contexts/SpotlightContext.tsx`
- Delete: `frontend/components/spotlight/TourStepCard.tsx`
- Delete: `frontend/components/spotlight/` (the directory, if now empty)
- Modify: `frontend/constants/spotlightConfig.ts`

- [ ] **Step 1: Delete the spotlight context file**

```bash
rm /Users/abhik.ray/Kindred/frontend/contexts/SpotlightContext.tsx
```

- [ ] **Step 2: Delete the tour step card and its empty parent directory**

```bash
rm /Users/abhik.ray/Kindred/frontend/components/spotlight/TourStepCard.tsx
rmdir /Users/abhik.ray/Kindred/frontend/components/spotlight 2>/dev/null || true
```

- [ ] **Step 3: Remove `SPOTLIGHT_MOTION` from `spotlightConfig.ts`**

Edit `frontend/constants/spotlightConfig.ts` to remove the SPOTLIGHT_MOTION export. The file becomes:

```ts
export const ONBOARDING_WORKSPACE = "🌺 Kindred Guide";
```

(Keep `ONBOARDING_WORKSPACE` — it's still used by `app/(onboarding)/tutorial.tsx`.)

- [ ] **Step 4: Type-check**

```bash
cd /Users/abhik.ray/Kindred/frontend && bunx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "SPOTLIGHT_MOTION|SpotlightContext|TourStepCard" | head -10
```

Expected: no remaining references.

- [ ] **Step 5: Commit**

```bash
cd /Users/abhik.ray/Kindred && git add -A frontend/contexts/ frontend/components/spotlight/ frontend/constants/spotlightConfig.ts && git commit -m "refactor: delete unused spotlight files"
```

---

## Task 12: Remove `react-native-spotlight-tour` from package.json

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/bun.lockb`

- [ ] **Step 1: Uninstall the package**

```bash
cd /Users/abhik.ray/Kindred/frontend && bun remove react-native-spotlight-tour
```

Expected: the package is removed from `dependencies` in `package.json` and `bun.lockb` is updated.

- [ ] **Step 2: Verify no remaining imports**

```bash
grep -r "react-native-spotlight-tour" /Users/abhik.ray/Kindred/frontend --include="*.ts" --include="*.tsx" | grep -v node_modules
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd /Users/abhik.ray/Kindred && git add frontend/package.json frontend/bun.lockb && git commit -m "chore: drop react-native-spotlight-tour dependency"
```

---

## Task 13: Pure-logic helpers for the checklist + unit tests

**Files:**
- Create: `frontend/utils/onboardingChecklist.ts`
- Create: `frontend/__tests__/onboardingChecklist.test.ts`

This task uses TDD. The pure logic is small and the rules are tricky enough to benefit from tests.

- [ ] **Step 1: Write the failing test file**

Create `frontend/__tests__/onboardingChecklist.test.ts`:

```ts
import {
    computeCompletion,
    computeVisibleItems,
    shouldShowCard,
    type ChecklistUser,
    type ItemKey,
} from '@/utils/onboardingChecklist';

const baseUser: ChecklistUser = {
    tasks_complete: 0,
    encouragements: 0,
    congratulations: 0,
    friends: [],
    first_all_rings_closed_at: null,
};

describe('computeCompletion', () => {
    it('flags task complete when tasks_complete > 0', () => {
        const c = computeCompletion({ ...baseUser, tasks_complete: 1 });
        expect(c.task).toBe(true);
    });

    it('flags kudos complete when encouragements + congratulations > 0', () => {
        expect(computeCompletion({ ...baseUser, encouragements: 1 }).kudos).toBe(true);
        expect(computeCompletion({ ...baseUser, congratulations: 1 }).kudos).toBe(true);
        expect(computeCompletion(baseUser).kudos).toBe(false);
    });

    it('flags friend complete when friends list non-empty', () => {
        expect(computeCompletion({ ...baseUser, friends: ['abc'] }).friend).toBe(true);
        expect(computeCompletion(baseUser).friend).toBe(false);
    });

    it('flags rings complete when first_all_rings_closed_at is set', () => {
        expect(computeCompletion({ ...baseUser, first_all_rings_closed_at: '2026-05-30T00:00:00Z' }).rings).toBe(true);
        expect(computeCompletion(baseUser).rings).toBe(false);
    });
});

describe('computeVisibleItems', () => {
    it('shows task/kudos/friend for a brand-new user (rings gated)', () => {
        const visible = computeVisibleItems({ task: false, kudos: false, friend: false, rings: false });
        expect(visible).toEqual(['task', 'kudos', 'friend']);
    });

    it('shows kudos/friend/rings once task is done', () => {
        const visible = computeVisibleItems({ task: true, kudos: false, friend: false, rings: false });
        expect(visible).toEqual(['kudos', 'friend', 'rings']);
    });

    it('keeps rings hidden when only kudos and friend are done (task still pending)', () => {
        const visible = computeVisibleItems({ task: false, kudos: true, friend: true, rings: false });
        expect(visible).toEqual(['task']);
    });

    it('shows just two items when task + kudos done', () => {
        const visible = computeVisibleItems({ task: true, kudos: true, friend: false, rings: false });
        expect(visible).toEqual(['friend', 'rings']);
    });

    it('shows nothing when all four are done', () => {
        const visible = computeVisibleItems({ task: true, kudos: true, friend: true, rings: true });
        expect(visible).toEqual([]);
    });
});

describe('shouldShowCard', () => {
    it('hides when dismissed', () => {
        const completion = { task: false, kudos: false, friend: false, rings: false };
        expect(shouldShowCard(completion, true)).toBe(false);
    });

    it('hides when all complete even if not dismissed', () => {
        const completion = { task: true, kudos: true, friend: true, rings: true };
        expect(shouldShowCard(completion, false)).toBe(false);
    });

    it('shows when at least one is incomplete and not dismissed', () => {
        const completion = { task: true, kudos: false, friend: false, rings: false };
        expect(shouldShowCard(completion, false)).toBe(true);
    });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd /Users/abhik.ray/Kindred/frontend && bun test __tests__/onboardingChecklist.test.ts
```

Expected: FAIL with "Cannot find module '@/utils/onboardingChecklist'".

- [ ] **Step 3: Implement the helper module**

Create `frontend/utils/onboardingChecklist.ts`:

```ts
export type ItemKey = 'task' | 'kudos' | 'friend' | 'rings';

export interface ChecklistUser {
    tasks_complete: number;
    encouragements: number;
    congratulations: number;
    friends: string[];
    first_all_rings_closed_at: string | null | undefined;
}

export type CompletionMap = Record<ItemKey, boolean>;

export function computeCompletion(user: ChecklistUser): CompletionMap {
    return {
        task: user.tasks_complete > 0,
        kudos: (user.encouragements ?? 0) + (user.congratulations ?? 0) > 0,
        friend: user.friends.length > 0,
        rings: !!user.first_all_rings_closed_at,
    };
}

const PRIORITY: ItemKey[] = ['task', 'kudos', 'friend', 'rings'];

export function computeVisibleItems(completion: CompletionMap): ItemKey[] {
    const incomplete = PRIORITY.filter((key) => !completion[key]);
    // Rings is gated: hide it unless `task` is complete.
    const gated = completion.task ? incomplete : incomplete.filter((k) => k !== 'rings');
    return gated.slice(0, 3);
}

export function shouldShowCard(completion: CompletionMap, dismissed: boolean): boolean {
    if (dismissed) return false;
    return Object.values(completion).some((done) => !done);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd /Users/abhik.ray/Kindred/frontend && bun test __tests__/onboardingChecklist.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/abhik.ray/Kindred && git add frontend/utils/onboardingChecklist.ts frontend/__tests__/onboardingChecklist.test.ts && git commit -m "feat: onboarding checklist pure logic + tests"
```

---

## Task 14: Build the `OnboardingChecklist` component shell

**Files:**
- Create: `frontend/components/dashboard/OnboardingChecklist.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/components/dashboard/OnboardingChecklist.tsx`:

```tsx
import React, { useCallback, useMemo, useState } from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { useAuth } from '@/hooks/useAuth';
import { useCreateModal } from '@/contexts/createModalContext';
import { Screen } from '@/components/modals/CreateModal';
import { HORIZONTAL_PADDING } from '@/constants/spacing';
import {
    computeCompletion,
    computeVisibleItems,
    shouldShowCard,
    type ChecklistUser,
    type ItemKey,
} from '@/utils/onboardingChecklist';

const LABELS: Record<ItemKey, string> = {
    task: 'Make your first task',
    kudos: 'Send your first kudos',
    friend: 'Add a friend',
    rings: 'Close all 3 rings in a day',
};

interface OnboardingChecklistProps {
    scrollRef: React.RefObject<ScrollView>;
    kudosOffsetRef: React.MutableRefObject<number>;
}

export const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({ scrollRef, kudosOffsetRef }) => {
    const router = useRouter();
    const ThemedColor = useThemeColor();
    const { user } = useAuth();
    const { openModal } = useCreateModal();
    const [dismissed, setDismissed] = useState(false); // wired to AsyncStorage in next task

    const completion = useMemo(() => {
        if (!user) return null;
        return computeCompletion(user as unknown as ChecklistUser);
    }, [user]);

    const visible = useMemo(() => (completion ? computeVisibleItems(completion) : []), [completion]);
    const totalDone = completion ? Object.values(completion).filter(Boolean).length : 0;

    const handleRowPress = useCallback((key: ItemKey) => {
        switch (key) {
            case 'task':
                openModal({ screen: Screen.Create, target: undefined });
                break;
            case 'kudos':
                scrollRef.current?.scrollTo({ y: kudosOffsetRef.current, animated: true });
                break;
            case 'friend':
                router.push('/(logged-in)/(tabs)/(search)/search');
                break;
            case 'rings':
                router.push('/(logged-in)/(tabs)/(feed,search,profile)/profile' as any);
                break;
        }
    }, [openModal, router, scrollRef, kudosOffsetRef]);

    if (!completion || !shouldShowCard(completion, dismissed)) return null;

    return (
        <View style={{ marginHorizontal: HORIZONTAL_PADDING, marginBottom: 18 }}>
            <View
                style={{
                    backgroundColor: ThemedColor.lightenedCard,
                    borderRadius: 20,
                    padding: 18,
                    borderWidth: 1,
                    borderColor: ThemedColor.tertiary,
                }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>
                        Get started on Kindred
                    </ThemedText>
                    <ThemedText style={{ fontSize: 12, color: ThemedColor.primary }}>
                        {totalDone} of 4
                    </ThemedText>
                </View>

                {/* slim progress bar */}
                <View
                    style={{
                        height: 4,
                        backgroundColor: ThemedColor.tertiary,
                        borderRadius: 100,
                        marginTop: 10,
                        marginBottom: 14,
                        overflow: 'hidden',
                    }}>
                    <View
                        style={{
                            width: `${(totalDone / 4) * 100}%`,
                            height: '100%',
                            backgroundColor: ThemedColor.primary,
                            borderRadius: 100,
                        }}
                    />
                </View>

                {visible.map((key) => (
                    <ChecklistRow
                        key={key}
                        label={LABELS[key]}
                        onPress={() => handleRowPress(key)}
                        ThemedColor={ThemedColor}
                    />
                ))}

                <TouchableOpacity
                    onPress={() => setDismissed(true)}
                    style={{ alignSelf: 'flex-end', paddingVertical: 6, marginTop: 4 }}>
                    <ThemedText type="caption" style={{ fontSize: 12 }}>
                        Dismiss
                    </ThemedText>
                </TouchableOpacity>
            </View>
        </View>
    );
};

interface ChecklistRowProps {
    label: string;
    onPress: () => void;
    ThemedColor: ReturnType<typeof useThemeColor>;
}

const ChecklistRow: React.FC<ChecklistRowProps> = ({ label, onPress, ThemedColor }) => (
    <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
        <View
            style={{
                width: 18,
                height: 18,
                borderRadius: 100,
                borderWidth: 1.5,
                borderColor: ThemedColor.caption,
            }}
        />
        <ThemedText style={{ flex: 1, fontSize: 14 }}>{label}</ThemedText>
        <ThemedText style={{ color: ThemedColor.caption, fontSize: 14 }}>›</ThemedText>
    </TouchableOpacity>
);
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/abhik.ray/Kindred/frontend && bunx tsc --noEmit -p tsconfig.json 2>&1 | grep "OnboardingChecklist" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/abhik.ray/Kindred && git add frontend/components/dashboard/OnboardingChecklist.tsx && git commit -m "feat: OnboardingChecklist component shell with dismiss"
```

---

## Task 15: Wire AsyncStorage for dismissal + transition toast

**Files:**
- Modify: `frontend/components/dashboard/OnboardingChecklist.tsx`

- [ ] **Step 1: Replace the `dismissed` local state with AsyncStorage-backed state**

In `OnboardingChecklist.tsx`, add imports near the top:

```tsx
import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showToastable } from 'react-native-toastable';
import DefaultToast from '@/components/ui/DefaultToast';
import type { CompletionMap } from '@/utils/onboardingChecklist';
```

Add the constants:

```tsx
const TOAST_COPY: Record<ItemKey, string> = {
    task: 'Nice — first task done. Keep going.',
    kudos: 'First kudos sent. Spread the love.',
    friend: 'Friend added. You\'re not alone in this.',
    rings: 'All three rings closed. That\'s the move.',
};

const dismissKey = (userId: string) => `${userId}-onboarding-checklist-dismissed`;
const snapshotKey = (userId: string) => `${userId}-onboarding-checklist-snapshot`;
```

Replace the `useState(false)` for `dismissed` with:

```tsx
const [dismissed, setDismissed] = useState<boolean | null>(null); // null = still loading

useEffect(() => {
    if (!user?._id) return;
    let cancelled = false;
    AsyncStorage.getItem(dismissKey(user._id)).then((v) => {
        if (!cancelled) setDismissed(v === 'true');
    });
    return () => { cancelled = true; };
}, [user?._id]);

const handleDismiss = useCallback(() => {
    if (!user?._id) return;
    AsyncStorage.setItem(dismissKey(user._id), 'true').catch(() => {});
    setDismissed(true);
}, [user?._id]);
```

Replace the `onPress={() => setDismissed(true)}` in JSX with `onPress={handleDismiss}`.

Change the early return guard to also wait for dismiss-state load:

```tsx
if (!completion || dismissed === null || !shouldShowCard(completion, dismissed)) return null;
```

- [ ] **Step 2: Add the snapshot-diff + toast effect**

Above the JSX return, add:

```tsx
const snapshotLoadedRef = useRef(false);
const lastSnapshotRef = useRef<CompletionMap | null>(null);

useEffect(() => {
    if (!user?._id || !completion) return;

    if (!snapshotLoadedRef.current) {
        snapshotLoadedRef.current = true;
        AsyncStorage.getItem(snapshotKey(user._id)).then((raw) => {
            if (raw) {
                try { lastSnapshotRef.current = JSON.parse(raw) as CompletionMap; } catch {}
            }
            // Record current completion silently on first mount.
            lastSnapshotRef.current = lastSnapshotRef.current ?? completion;
            AsyncStorage.setItem(snapshotKey(user._id), JSON.stringify(completion)).catch(() => {});
        });
        return;
    }

    const prev = lastSnapshotRef.current;
    if (!prev) return;

    (['task', 'kudos', 'friend', 'rings'] as ItemKey[]).forEach((key) => {
        if (!prev[key] && completion[key]) {
            showToastable({
                title: 'Onboarding',
                message: TOAST_COPY[key],
                status: 'success',
                duration: 3500,
                renderContent: (props) => <DefaultToast {...props} />,
            });
        }
    });

    lastSnapshotRef.current = completion;
    AsyncStorage.setItem(snapshotKey(user._id), JSON.stringify(completion)).catch(() => {});
}, [completion, user?._id]);
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/abhik.ray/Kindred/frontend && bunx tsc --noEmit -p tsconfig.json 2>&1 | grep OnboardingChecklist | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/abhik.ray/Kindred && git add frontend/components/dashboard/OnboardingChecklist.tsx && git commit -m "feat: persist checklist dismissal + fire toast on completion transitions"
```

---

## Task 16: Mount the checklist in `HomescrollContent.tsx`

**Files:**
- Modify: `frontend/components/dashboard/HomescrollContent.tsx`
- Modify: `frontend/app/(logged-in)/(tabs)/(task)/index.tsx`

- [ ] **Step 1: Add the new prop and mount the component**

In `frontend/components/dashboard/HomescrollContent.tsx`:

1. Import the component near the top:
   ```tsx
   import { OnboardingChecklist } from './OnboardingChecklist';
   ```
2. Add `kudosOffsetRef` to `HomeScrollContentProps`:
   ```tsx
   kudosOffsetRef: React.MutableRefObject<number>;
   ```
3. Destructure it in the component args.
4. Insert the checklist component between `<DashboardStats />` and `<WorkingOnRow />` (around line 363-366). Result:
   ```tsx
   <View style={{ marginHorizontal: HORIZONTAL_PADDING, marginBottom: 8, gap: 10 }}>
       <DashboardStats onExpandChange={handleStatsExpandChange} />
   </View>
   <OnboardingChecklist scrollRef={scrollRef} kudosOffsetRef={kudosOffsetRef} />
   <WorkingOnRow />
   ```
5. Update `onKudosLayout` handler in the parent to also set `kudosOffsetRef.current = layout.y`.

- [ ] **Step 2: Pass the new prop from the parent**

`frontend/app/(logged-in)/(tabs)/(task)/index.tsx` already owns `kudosOffsetRef` and `onKudosLayout` (added in Task 10). Just add `kudosOffsetRef={kudosOffsetRef}` to the `<HomeScrollContent>` JSX prop list so the new component can read the offset.

- [ ] **Step 3: Type-check**

```bash
cd /Users/abhik.ray/Kindred/frontend && bunx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "HomescrollContent|index.tsx" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/abhik.ray/Kindred && git add frontend/components/dashboard/HomescrollContent.tsx "frontend/app/(logged-in)/(tabs)/(task)/index.tsx" && git commit -m "feat: mount OnboardingChecklist below dashboard stats"
```

---

## Task 17: Manual verification

**Files:** none

- [ ] **Step 1: Launch the iOS simulator**

Run:

```bash
cd /Users/abhik.ray/Kindred/frontend && bunx expo run:ios --device "iPhone 16 Pro"
```

(Pick whatever simulator is convenient. Build the dev client if a custom build is required.)

- [ ] **Step 2: Confirm spotlight tour is gone**

Sign in (or use an existing account). Navigate Home → Workspace → Task → Create modal. None of these screens should show the old spotlight overlay.

- [ ] **Step 3: Confirm the checklist appears**

On the home screen, the card titled "Get started on Kindred" should appear between the stats strip and the Working On row, showing 3 rows (task / kudos / friend, since rings is gated until task done) and the dismissable link.

- [ ] **Step 4: Confirm auto-detection**

- Tap "Make your first task" → create-task sheet opens. Create a task, complete it. Return to home: row checks off, toast fires ("Nice — first task done. Keep going."), rings row slides into view.
- Tap "Send your first kudos" → home scrolls to Kudos section. Send a kudos. Return to home: row checks off, toast fires.
- Tap "Add a friend" → search tab opens. Add a friend. Return to home: row checks off, toast fires.
- Close all three rings in one day. Re-open home. Row checks off, toast fires.

- [ ] **Step 5: Confirm dismissal**

Tap "Dismiss". Card hides. Force-quit and re-open the app. Card stays hidden.

- [ ] **Step 6: Confirm all-done auto-hide**

(Optional, if all 4 items aren't yet complete by step 4.) With all 4 items complete, the card should not render at all on home.

- [ ] **Step 7: Final commit (if any cleanup) + open PR**

If no further changes:

```bash
cd /Users/abhik.ray/Kindred && git push -u origin onboarding-checklist
```

Open a PR from `onboarding-checklist` → `main` titled `feat: onboarding checklist (replace spotlight tour)`. Body should reference the spec and the verification steps above.

---

## Notes for the implementer

- The spec is at `docs/superpowers/specs/2026-05-30-onboarding-checklist-design.md` — read it before starting Task 1 if anything in this plan is unclear.
- Each task is independently committable; do not batch.
- If a type-check error survives a task, fix it inside that task before moving on — don't carry red into the next one.
- The route used for the rings deep-link is a guess (`/(logged-in)/(tabs)/(feed,search,profile)/profile`). Confirm the actual route at implementation time and adjust the `case 'rings':` branch.
- The toast uses the existing `DefaultToast` component to match the rest of the app's toasts (deadline live activity, etc.).
- AsyncStorage keys are user-scoped to avoid bleed on shared devices.
