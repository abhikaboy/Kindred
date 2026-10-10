# Onboarding v2: drop users into the real app

Status: **plan, nothing implemented.** Companion to [onboarding-flow.md](onboarding-flow.md), which documents the current flow. Visual rules come from [DESIGN.md](../DESIGN.md).

## 1. Why change it

The current guest tutorial is a separate, scripted screen (`app/(onboarding)/tutorial.tsx`, ~1400 lines) that uses a fake "(Not Real) Workspace" and a canned "Go for a 15-minute walk" task. It then hands off to a home tour (`hooks/useHomeTour.ts`) that spotlights four sections of Home.

Problems:

- **Users learn a demo, then start over.** The task they "complete" is fake, and the real app is a fresh surface.
- **Two teaching systems overlap.** The tutorial teaches tasks and rings; the home tour re-teaches rings, focus, quick add, and workspaces on the same screen.
- **Permissions come too early.** The notification prompt fires during the first step (open issue in onboarding-flow.md §10).
- **Asks come before value.** We request things before the user has gotten anything out of the app.

Direction: teach inside the real app, with the user's own data, and let the home screen carry the explanation.

## 2. Decisions

- **Swipe-down exists.** Pulling down on Home reveals the workspaces. Step 0 builds on that gesture; no new gesture is needed.
- **Reuse the "Kindred Guide" workspace.** Step 1 uses the workspace the backend already seeds (`ONBOARDING_WORKSPACE` in `constants/spotlightConfig.ts`). We don't create a second one.
- **Guest account prompt is as late as possible,** right before step 8, not during the flow.
- **Minimal and aesthetic,** per DESIGN.md. See §6.

## 3. Proposed flow

Each step is one moment of value. The user moves on only after doing the action.

| # | Moment | What the user sees | Exit condition |
|---|---|---|---|
| 0 | Land on Home | One coach line in the pull-down area: "Pull down to find your workspaces." | User pulls down |
| 1 | Open Kindred Guide | Workspaces revealed; Kindred Guide is the one highlighted. Coach: "Open Kindred Guide." | User opens it |
| 2 | Create a category | Inside Kindred Guide. Coach: "Categories group related tasks. Make one." | Category saved |
| 3 | Create a task | Coach: "Add your first task." Task prefilled, editable | Task saved |
| 4 | Back to Home | Coach points at the rings: "Close all three rings every day." | User taps Continue |
| 5 | Explain rings | One short line per ring (Plan, Do, Share), using existing ring copy | Continue through Share |
| 6 | Quick add | Coach points at the quick-add bar: "Add anything here, like gym @7am tomorrow." | User submits one quick add |
| 7 | Guest account prompt | Existing `useAccountOverlay` prompt, reason `skipped-tutorial`-style, shown only for guests | Dismiss or sign up |
| 8 | Done | Coach: "You're set." Dismisses itself | Auto-dismiss after the first real completion |

Notes:

- Steps 4 to 6 bring the user back to Home after they've made their own task, so the explanation lands on real data.
- Step 6 teaches the quick-add input they'll use day to day.
- The account prompt goes right before the end. Notifications move after step 8, or after the first completed task.

## 4. What gets cut

- **Delete** `app/(onboarding)/tutorial.tsx` once v2 is live. Move `RING_INFO` and the ring copy to a shared constant.
- **Trim** `useHomeTour` from four steps to rings and quick add. "Focus" and "workspaces" go, since steps 0 to 3 cover workspaces.
- **Remove** the demo content: "(Not Real) Workspace", the "BEAK" founder message, the congrats GIF, and the share-photo demo.
- **Keep** `useAccountOverlay`. Its task-limit and social triggers still make sense.

## 5. Triggers and state

- **Trigger:** a new user whose only workspace is Kindred Guide and who has no v2 flag set. The coach runs on the new Home.
- **State:** one persisted step index in AsyncStorage, keyed by user id, so it resumes if the app is killed mid-step.
- **Skip:** a quiet "Skip" text link on the coach. Sets the flag and ends the flow. Analytics include `skipped_at_step`.
- **Migration:** replace `-home-tour-seen`, `-intro-tour-seen`, and `-quicksetup` with one v2 flag. Anyone who already finished the tour counts as done.

## 6. Design constraints (from DESIGN.md)

- **No blocking overlays.** DESIGN.md forbids explainer modals before a user can start. The Home blur in the first draft would be one. Use a non-blocking treatment: the coach sits inline in the content, and the rest of Home stays readable. Drop the blur unless it's needed to focus the eye, and if it stays, it must not intercept touches.
- **No emojis.** The seeded name "🌺 Kindred Guide" includes one. Decide whether to keep it in the seed or rename it to plain "Kindred Guide". I'd rename it, since emojis are banned everywhere else.
- **No eyebrows, no nested cards, no decorative borders.** The coach is one line of text with one action, not a card inside a card.
- **One headline per screen.** Coach copy is light Outfit. No Fraunces in the coach.
- **Instant, quiet motion.** Taps apply immediately. No springs or staggered reveals for the coach.
- **Reuse existing components.** The coach should use the existing bottom-sheet or hint components, not a bespoke one. Check `components/` before building.

## 7. Open questions

1. **Emoji in the seeded name.** Rename the seed to "Kindred Guide", or keep the emoji for existing users and drop it only for new ones?
2. **Blur.** Keep a non-blocking blur, or drop it entirely?
3. **Existing guest users** mid-tutorial. Do they go straight to v2 from step 0, or finish the old tutorial?

## 8. Implementation phases

1. **Coach component.** One inline coach driven by a step config (anchor, copy, exit condition), built on existing components.
2. **Steps 0 to 3:** pull-down, open Kindred Guide, category, task.
3. **Steps 4 to 8:** back to Home, rings, quick add, account prompt, done.
4. **State, skip, migration, analytics.**
5. **Delete** the scripted tutorial and trimmed home-tour code. Update the e2e flows in `frontend/e2e/flows/02*` and `03*`.
6. **Move** the notification prompt to after step 8, per the open issue.

## 9. Verification

- Unit: step exit conditions and flag migration.
- Simulator, fresh install per run: reach each step, kill the app mid-step and confirm it resumes, skip at each step, and confirm existing users skip v2.
- Confirm no permission prompt before step 8 and the account prompt only appears at step 7.
- Confirm the coach doesn't block touches on Home.
- Confirm analytics fire once per step.

## 10. Separate fix: "Find your people" empty state

The empty state's container used `alignItems: "flex-start"`, which squeezed the numbered steps into a narrow column. It's now `stretch` in `components/dashboard/FriendsContent.tsx`. Needs a simulator check on the friends page.
