# contexts — Agent Guide

Global React context providers for app state. Each exports a `XProvider` and a `useX()` hook that throws if used outside its provider.

## Key files
- `tasksContext.tsx` — the big one (~675 lines). Nested workspaces→categories→tasks, heavy `useMemo` derived state (`unnestedTasks`, `startTodayTasks`, `dueTodayTasks`, phantom/upcoming tasks), AsyncStorage cache, and device-widget sync on task changes.
- `kudosContext.tsx` — encouragements + congratulations, unread counts, sorted desc.
- `AlertContext.tsx` — queue-based alerts (max 10, ~400ms debounce between shows).
- `focusModeContext.tsx`, `drawerContext.tsx`, `PostComposerContext.tsx` — small single-purpose toggles/holders.
- `dragContext.tsx` — drag-a-task-between-categories. Holds the category hit-rect map (`rectsRef`), finger position (reanimated shared values), `hoveredCategoryId`, and calls `moveTask` on drop. `useDragOptional()` returns `null` outside a provider so view-only/encourage screens degrade gracefully.

## Conventions
- `PascalCase` provider, `useX` hook; wrap the context value in `useMemo`.
- AsyncStorage keys are scoped by `userId` (or workspace) to prevent cross-user leaks.
- `useState`-per-field, no reducers.

## Gotchas
- `tasksContext` has large `useMemo` dependency arrays — a missing dep breaks memoization and can cause infinite re-renders. Edit deps carefully.
- Widget sync runs on every `unnestedTasks`/`dueTodayTasks` change (deferred via `InteractionManager`) and needs the native widget code.
- Persistence is inconsistent — some contexts persist, some don't (e.g. kudos).
- **`dragContext` is per workspace page, not global.** `WorkspacePager` mounts one `DragProvider` per page, so each page has its own `rectsRef` and finger state. A card and the categories on its page share one provider — there is no single app-wide drag state.
- Hit-rects are **window-space**, captured by each `Category` via `measureInWindow`. They go stale on scroll, so each rect stores `scrollYAtMeasure` and hit-testing subtracts the live offset fed in via `setScrollOffset` (wired from each screen's `onScroll` + the drag auto-scroll loop). They also go stale on PagerView page-reveal — see `components/AGENTS.md`.
