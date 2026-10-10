# Onboarding v2: build spec

Status: **spec, not yet built.** Parent plan: [onboarding-v2-plan.md](onboarding-v2-plan.md). Current flow: [onboarding-flow.md](onboarding-flow.md). Visual rules: [DESIGN.md](../DESIGN.md).

Decisions already made (from the plan review):
- Keep the 🌺 emoji in the seeded "🌺 Kindred Guide" name.
- Keep the Home blur for now, as a passive backdrop.
- No guests mid-tutorial exist, so there is no migration for them.
- The guest account prompt is step 7, right before done.
- Workspace reveal uses the existing vertical snap-scroll on Home.

## 1. Scope

In scope: the v2 step machine, the coach UI, the reuse of Kindred Guide, persistence, skip, analytics, and a dev-only harness.

Out of scope for v1: changing the backend seed, redesigning the rings, changing the account overlay copy.

## 2. Code anchors

Verified by the anchor map (see §11 for the open items).

| Concern | Anchor |
|---|---|
| Home screen, outer pager | `frontend/app/(logged-in)/(tabs)/(task)/index.tsx` (`PagerView` :29, :406–441; `pagerRef` :220; `homeScrollRef` :163) |
| Workspaces reveal | `frontend/components/dashboard/HomescrollContent.tsx`: `Reanimated.ScrollView` :261, `snapOffsets = [0, viewportHeight]` :254, `toWorkspaces()` :255 (local, not exported) |
| Create workspace UI | `frontend/components/modals/CreateWorkspaceBottomSheetModal.tsx` (default export :98), `components/modals/create/NewWorkspace.tsx` :104 |
| Create workspace API | `frontend/api/workspace.tsx:21` `createWorkspace(name, icon?, color?)` |
| Seeded guide workspace | Backend `SetupDefaultWorkspace` in `backend/internal/handlers/auth/service.go` (~:312, name :315, idempotent :318–327). Frontend id: `ONBOARDING_WORKSPACE` in `frontend/constants/spotlightConfig.ts:1`. Matched by exact name. |
| Create category | `frontend/api/category.ts:19` `createCategory(name, workspaceName, silent?)`; UI `frontend/components/InlineCategoryCreator.tsx:27` |
| Create task | FAB → `useCreateModal().openModal()` (`frontend/contexts/createModalContext.tsx:38`); API `frontend/api/task.ts:28` `createTaskAPI`. **Concrete task form not located** (see §11). |
| Quick add | `frontend/components/dashboard/HomeQuickAddDock.tsx:39` → `QuickCapture` (`QuickCapture.tsx:20–24`, `placeholder` prop). Composer input `QuickCaptureComposer.tsx:137`. |
| Rings copy | `RING_INFO` in `frontend/app/(onboarding)/tutorial.tsx:157–161` (local, not shared). Home rings: `components/profile/ProductivityRings.tsx` (:532). |
| Blur | `BlurView` already used in `components/dashboard/HomeTourOverlay.tsx:52` |
| Account prompt | `frontend/hooks/useAccountOverlay.ts`: `openAccountOverlay(reason, options?)` :89, `AccountOverlayReason` includes `"skipped-tutorial"` :16 |
| Home tour | `frontend/hooks/useHomeTour.ts` (steps :12–17, key `${user._id}-home-tour-seen` :27), mounted at `index.tsx:168` and `HomeTourOverlay` at `index.tsx:448` |
| Routing | `frontend/app/index.tsx`, `frontend/utils/guestEntry.ts` (`routeForGuest` :12–18) |
| Reusable UI | `components/ui/HintBubble.tsx` (text, onDone, autoDismissMs; one-line inline coach candidate) |
| Analytics | `frontend/utils/analytics.ts:34–37` events; `OnboardingSteps` :174–182 |

## 3. Step machine

One persisted integer `step` per user. `done` is stored as `step = 9`.

| Step | Key | Coach copy | Anchor | Exit condition |
|---|---|---|---|---|
| 0 | `reveal` | "Swipe to see your workspaces." | Home, vertical snap | `homeScrollRef` reaches `viewportHeight` (`onMomentumScrollEnd` or scroll Y ≥ 0.5 × viewport) |
| 1 | `openGuide` | "Open Kindred Guide." | Kindred Guide row in workspaces | Route/selection changes to the guide workspace |
| 2 | `category` | "Categories group related tasks. Make one." | Guide workspace header "+" | A category is created in the guide workspace |
| 3 | `task` | "Add your first task." | Category's add action | A task exists in that category |
| 4 | `rings` | "Close all three rings every day." | Home rings | Continue tapped |
| 5 | `ringDetail` | One line per ring (Plan, Do, Share), tap-through | Rings explainer | Continue tapped after Share |
| 6 | `quickAdd` | "Add anything here, like gym @7am tomorrow." | `HomeQuickAddDock` | One quick add submitted |
| 7 | `account` | Existing account prompt (guest only) | `useAccountOverlay` | Dismissed or signed up. Skipped for non-guests. |
| 8 | `finish` | "You're set." | Home | Auto-dismiss after the first completed task, or tapped |
| 9 | `done` | none | none | terminal |

Rules:
- Steps 0–3 must complete in order. Each step's exit fires only for the current step.
- Steps 4–8 can be re-entered from Home only by the dev harness (§7). Production never re-enters.
- If the user already has tasks or categories in Kindred Guide when they start, step 2 and 3 are skipped (exit immediately). Do not block on them.

## 4. Coach UI

- A single inline coach: one line of Outfit text, one optional text action ("Skip" on the left, "Continue" on the right when a step needs a tap). No card, no border, soft shadow only.
- Position: anchored just below the target when measurable, otherwise at the top of the content area.
- The Home blur is a passive `BlurView` (`pointerEvents="none"`) that dims the page behind the anchored target. Touches pass through to the page everywhere except the coach's own controls. This keeps it non-blocking per DESIGN.md.
- Enter and exit: a 200 ms cross-fade. No springs, no scale.
- Taps apply immediately. A new tap interrupts any current animation.
- Only one coach is visible at a time.
- Typography: `ThemedText type="default"` for the line, `type="defaultSemiBold"` only for the Continue action. No Fraunces in the coach.

Implementation note: build it on `HintBubble` if its props suffice. Otherwise add a `Coach` component next to it in `components/onboarding/`. Do not copy `HomeTourOverlay`'s spotlight code.

## 5. Persistence, skip, and routing

- Storage key: `` `${userId}-onboarding-v2-step` `` holds the step integer as a string (`onboardingV2StepKey` in `utils/devOnboarding.ts`).
- Read on Home mount. If the key is absent and the user is new, set `step = 0` and show the coach. A user counts as new when the only workspace they have is Kindred Guide and they have no `${userId}-home-tour-seen` flag.
- Existing users who already have `${userId}-home-tour-seen` are set to `done` on first run. This prevents the coach from appearing for them.
- Skip: a "Skip" action on the coach sets `step = 9`, stops the coach, and emits `onboarding_abandoned` with `skipped_at_step`.
- Resume: after a kill mid-step, the stored step is read on next launch. Steps 0–3 resume from their step. Steps 4–8 resume from their step.
- Routing: new users are no longer sent to `/(onboarding)/tutorial`. `routeForGuest` should send them to Home. The scripted tutorial route is deleted in phase 5 of the plan, not in v1.

## 6. Analytics

Use the existing events with v2 step names. Do not add new event names.

- `ONBOARDING_STEP_VIEWED` / `ONBOARDING_STEP_COMPLETED` with `step_name` = `"v2_" + key` and `step_index` = the step number.
- `ONBOARDING_COMPLETED` once, at step 9.
- `ONBOARDING_ABANDONED` on skip, with `skipped_at_step`.

## 7. Dev harness (built in parallel)

A dev-only harness, gated by `__DEV__`, so a developer can test without reinstalling:
- `frontend/utils/devOnboarding.ts`: reset the v2 key and the legacy flags, set the step, read a debug snapshot.
- A dev screen or menu entry to view the snapshot, reset, and jump to any step 0–9.
- `scripts/onboarding-dev-reset.sh`: edits the iOS simulator's AsyncStorage manifest to clear `hasEverSignedIn` and set `guestInstall`, then relaunches. It does not clear the Keychain. A full reset needs `xcrun simctl erase`.
- Unit tests for key construction and step bounds.

Status: **built, not committed.** Files:
- `frontend/utils/devOnboarding.ts`: key builders (`onboardingV2StepKey` = `${userId}-onboarding-v2-step`), `ONBOARDING_V2_STEP_LABELS` for steps 0–8, and the `__DEV__`-gated `resetOnboardingState`, `setOnboardingV2Step`, `getOnboardingDebugSnapshot`.
- `frontend/app/dev-onboarding.tsx`: debug screen with the snapshot, reset and reload buttons, and jump buttons for steps 0–8. Redirects to `/` in release builds.
- `frontend/__tests__/devOnboarding.test.ts`: key construction and step bounds (4 tests, passing).
- `scripts/onboarding-dev-reset.sh`: terminates the app, backs up the simulator's AsyncStorage manifest, removes `hasEverSignedIn`, sets `guestInstall`, verifies, and relaunches. Not yet run against a simulator.

Usage:
- Screen: `xcrun simctl openurl booted "kindred:///dev-onboarding"`, then reload after a reset or step jump.
- Reset: `scripts/onboarding-dev-reset.sh`. It uses bundle ID `com.kindred.kindredtsl` by default and can be overridden with `KINDRED_BUNDLE_ID`. It does not clear the Keychain. For a full reset, use `xcrun simctl erase`.

Caveats:
- `resetOnboardingState()` with no user ID clears the onboarding keys for every user on the device.
- The manifest edit assumes AsyncStorage stores small values inline in `manifest.json`. This was observed on the simulator but not verified on a device. If the layout differs, the script fails its check rather than corrupting data.
- The v2 step key lives in `devOnboarding.ts` for now. Move it to `constants/authStorageKeys.ts` when the production flow uses it.
- No Settings row was added, to avoid touching production settings.

## 8. Acceptance criteria

1. A new user lands on Home with the step 0 coach visible, and the rest of the page is readable and tappable.
2. Each step advances only on its exit condition. Skipping at any step ends the flow and stores `done`.
3. Kill and relaunch mid-step resumes at the same step.
4. The guest account prompt appears only at step 7, and only for guests.
5. No permission prompt appears before step 8 (this is a regression check for the notification issue).
6. Existing users with the home tour flag never see the coach.
7. Analytics events fire once per step with the v2 names.
8. The coach passes DESIGN.md checks: no border, no card, no eyebrow, no emoji added by us, one line of copy.

## 9. Test plan

- Unit: step exit predicates, key helpers, migration rule.
- Simulator, fresh install per run (`xcrun simctl erase` when Keychain state matters):
  - Walk steps 0–8, verify the copy and anchors on each.
  - Kill during steps 2 and 5, relaunch, verify resume.
  - Skip at step 1, verify `done`.
  - Jump to step 7 with the dev harness, verify the account prompt shows only for guests.
- Regression: the notification prompt does not show before step 8.

## 10. Phases

1. Coach component and the blur backdrop, behind a dev flag.
2. Steps 0–3 wired to real actions in Kindred Guide.
3. Steps 4–8 wired to rings, quick add, account prompt, and finish.
4. Persistence, skip, resume, analytics.
5. Remove the scripted tutorial and the trimmed home tour. Update the e2e flows (`frontend/e2e/flows/02*`, `03*`).
6. Move the notification prompt to after step 8.

## 11. Open items

1. **Swipe direction.** The user says "swipe down" and the screen goes to workspaces. The code is a vertical snap to a lower viewport, and the existing tour copy says "Swipe up for your workspaces" (`useHomeTour.ts:16`). Confirm the direction and fix the tour copy if it's wrong.
2. **Task form (resolved).** `useCreateModal().openModal({ categoryId })` opens the create-task modal already scoped to a category. Host: `app/(logged-in)/_layout.tsx:577`, state in `contexts/createModalContext.tsx`. Step 3 calls `openModal({ categoryId: guideCategoryId })`.
0. **Bundle ID.** The app is `com.kindred.kindredtsl`. `frontend/e2e/flows/*.yaml` uses `com.suntex.kindred`, which is stale, so those flows need the same fix in phase 5.
3. **Testability.** `QuickCapture` and the Home workspace rows have no `testID`s. Add them in phase 1 so the e2e flows can target the coach and steps. This is additive and safe.
4. **RING_INFO** is local to the tutorial file. Move it to a shared constant in phase 5, since the copy is duplicated in five files.
5. **Blur intensity.** `QuickCaptureComposer.tsx:122` notes BlurView renders inconsistently. Check the backdrop on device before shipping.
