# First-Touch Feature Hints

**Date:** 2026-07-04
**Status:** Approved (touchpoints + swipe demo style selected by user)

## Goal

Teach features at their first touchpoint with brief, one-time, inline hints — demonstration over text wherever the UI can physically show the gesture. Never modal, never blocking, dismissed forever once seen.

## Mechanism

- `hooks/useFirstTouchHint.ts` — `useFirstTouchHint(key)` → `{ ready, done }`. `ready` flips true only if AsyncStorage `hint_<key>` is unset; `done()` persists dismissal. One hook, all hints.
- `components/ui/HintBubble.tsx` — small pill (Sparkle icon + one line, `lightened` background, fade in/out via reanimated), auto-dismisses after 5s or on tap; calls `onDone`. Used only where a demonstration isn't possible.

## Touchpoints (this round)

1. **Task swipe — demonstration** (`SwipableTaskCard`, key `swipe_actions`): the first swipeable card mounted anywhere auto-plays a both-sides peek — `openLeft()` (complete), close, `openRight()` (bell/flag/trash), close (~2.8s). Self-contained: the card claims the demo via a module-level flag so exactly one card plays it; no callsite changes. Marked done at demo start.
2. **FAB first sight** (`FloatingActionButton`, key `fab_intro`): two gentle scale pulses + HintBubble "Create anything from here" above the FAB on first appearance.
3. **Blueprint browse** (`blueprint/[id].tsx`, key `blueprints_intro`): HintBubble "Blueprints are ready-made routines — copy one into your workspace." on first detail open. (Creation flow already has `BlueprintIntroBottomSheet`; untouched.)
4. **Planner drag-to-schedule** (key `planner_drag`): existing tray hint re-keyed onto `useFirstTouchHint`; behavior unchanged (dismisses permanently on first successful drop, not on timeout).

## Rules

- One-time per install (AsyncStorage), no server state.
- Hints never gate interaction — everything works mid-hint; a real user action counts as dismissal where applicable.
- Theme tokens + ThemedText types only; phosphor icons.

## Out of scope

- Daily-page redesign of the unscheduled section (separate effort; the swipe demo replaces the "read this text" dependence in the meantime).
- Coach-mark/spotlight framework, hint sequencing, server-synced seen-state.

## Testing

- Unit: none beyond types — hook is a trivial AsyncStorage wrapper; demo/pulse are animation timing. Manual: fresh install shows each hint exactly once; relaunch shows none.
