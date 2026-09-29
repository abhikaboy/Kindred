# Onboarding plan: set up for real, with hints

Goal: a new user's first win takes seconds and lands in their own workspace,
not a demo. The tutorial stops being a separate practice run and becomes the
first few minutes of using Kindred, with hints that step in only when someone
hesitates.

## Where it stands (September 2026)

Guest path: launch → guest account → tutorial → Home. Registered path adds
phone/name/password/welcome before the tutorial, and the share and kudos beats
plus the calendar step after it.

The tutorial today mixes real and fake data, which is the core problem:

| Beat | What the user sees | What actually happens |
|---|---|---|
| Create workspace | A button, then "(Not Real) Workspace" | Nothing. The button only flips local state |
| Create category | "My Tasks" typed in for them | Real category, filed in the seeded "Kindred Guide" workspace |
| Add task | "Go for a 15-minute walk" typed in for them | Real task |
| Complete | Swipe right | Real completion. Rings, counts and checklist all move |
| Rings | Demo rings | Fake |
| Share, kudos (registered only) | Fake composer, fake feed, beak | A real kudos from beak and a real kudos to beak. No post |

After the tutorial, Home can stack up to four more first-run guides: the
quick setup sheet (six empty starter workspaces), the home tour, the intro
tour, and the account prompt. The user has already done "create a workspace"
once, but it wasn't real, so quick setup asks again.

Already fixed in the same change as this plan:
- Skip shows for everyone, not just guests. A registered user who skips still
  gets the calendar step, which has its own skip.
- Skipping marks the home tour, intro tour and quick setup as seen, so nothing
  stacks up on Home.
- The done flags fall back to the cached user, so a fast tap before the user
  loads no longer sends a guest back to the tutorial on next launch.
- Android back is blocked mid-tutorial, the same as iOS swipe-back already was.
- Skip analytics record the step it happened at.

## Prerequisite: guests keep what they build

Signing up from a guest session creates a brand-new user. The backend has no
upgrade or merge path (`auth/guest.go` creates the guest; register never looks
at it), and the client clears the query cache on the id change. That's
tolerable while tutorial data is throwaway. Once onboarding builds real
workspaces, a guest who signs up would lose them.

So this ships first: register and social sign-in, when called with a guest's
token, upgrade that user document in place (set credentials, clear `isGuest`)
instead of inserting a new one. The `IsGuest` field comment already describes
this behaviour; the code just doesn't do it yet.

## The new flow

Four beats, all real, all in the user's own workspace. Skip stays visible
throughout.

### 1. Workspace

Before the create button, two choices, shown as equal, quiet options:

- **Fill it in for me.** Creates one real starter workspace (for example
  "Personal", with "Errands" and "This week" categories and three ordinary
  tasks like "Pick up groceries"). The tasks are tagged as starter content so
  the user can clear them later in one tap. The user lands on the complete
  beat with something real to swipe.
- **Set it up myself.** A name field. If the field stays empty for about three
  seconds, one suggestion ("Personal") fades in under it as a tappable pill;
  tapping it fills the name. The icon is picked from the name instead of
  being required up front. Creates a real workspace with `createWorkspace`.

The six starters from the quick setup sheet (Work, School, Fitness, Finance,
Household, Hobbies) are the suggestion pool, so there's one source of starter
names. The quick setup sheet no longer auto-opens after onboarding, because
the user already has a workspace.

### 2. Category

`InlineCategoryCreator` inside the workspace they just made, not in Kindred
Guide. Same stuck rule: one generic suggestion fades in after a pause, picked
by workspace ("This week" for Work, "Classes" for School, "To do" otherwise).
One tap creates it.

### 3. Task

`CreateComposer`, the same one used everywhere else. One suggested task fades
in if the title stays empty ("Reply to one email", "15-minute walk"), tap to
fill. A `HintBubble` on the date chip: "Pick a day and Kindred will remind
you". This is where people first learn that auto remind exists, which pairs
with the new "Auto" label on the reminder chip.

### 4. Complete

Swipe right on the real card, with the existing swipe `HintBubble`. Confetti,
then one caption line about rings instead of the separate demo rings screen.
Then Home.

### Moved out of onboarding

- **Share and kudos beats.** They're fake, long, and registered users
  couldn't skip them. They become checklist items on Home ("Send your first
  kudos"), done for real when the user has a friend to send one to.
- **Home tour.** Its two points (rings and workspaces) become first-touch
  `HintBubble`s shown when the user first reaches each section. That's the
  pattern the rest of the app already uses.
- **Kindred Guide workspace.** Seed it only for users who skip, so it's a
  help space rather than the place a new user's first real task ends up. Its
  name also needs to lose the emoji.

## Hints: the rules

- One hint at a time, via `useFirstTouchHint`, as everywhere else.
- A suggestion appears only after the user hesitates, never immediately, and
  it cross-fades in quietly. A tap fills it in; typing makes it go away.
- Suggestions are generic and ordinary. No clever copy, no emojis.
- A hint never blocks input or waits on an animation.

## Measuring it

- One `ONBOARDING_STEP_COMPLETED` per beat, with `step_name`, whether a
  suggestion was tapped, and whether "Fill it in for me" was picked.
- Time from first launch to first completed task. This is the number the
  plan is trying to move.
- Seven-day retention for "Fill it in for me" compared with "Set it up
  myself", to see whether demo content helps or just gets deleted.

## Order of work

1. Guest upgrade in place (backend and client cache handling).
2. Workspace beat with both paths and stuck suggestions. Retire the fake
   workspace button and "(Not Real) Workspace".
3. Category and task beats target the new workspace, with suggestions and the
   date-chip hint.
4. Drop the rings demo and the share/kudos beats; add the kudos checklist
   item; turn the home tour into first-touch hints; stop auto-opening quick
   setup after onboarding.
5. Per-beat analytics and the time-to-first-win metric.
