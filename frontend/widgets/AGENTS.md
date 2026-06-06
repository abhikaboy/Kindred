# widgets — Agent Guide

iOS home-screen widgets and Live Activities, written in `@expo/ui/swift-ui` DSL and compiled to native layouts via expo-widgets.

## Key files
- `widgetUpdaters.ts` — factory singletons for every widget/activity (`TodayTasksWidgetUpdater`, `ActiveTaskActivityFactory`, `DeadlineCountdownActivityFactory`, `LockScreen*`, …). **Always go through these factories** — don't import widget components directly (avoids loading native modules at bundle eval).
- `ActiveTaskActivity.tsx` / `DeadlineCountdownActivity.tsx` — Live Activity banners (lock screen + Dynamic Island). Deep links use `kindred:///...?action=complete|dismiss`.
- `TodayTasksWidget.tsx`, `ActivityStreakWidget.tsx`, `LockScreenWidgets.tsx`, `WorkspaceSnapshotWidget.tsx` — home/lock-screen widgets.
- `updateStreakWidget.ts` — push streak data to the widget.

## Conventions
- Start component files with `'widget';` for Babel native compilation.
- Imperative data flow: `Factory.updateSnapshot(props)` / `updateTimeline([props])` — no React state in widgets.
- Live Activities return `{ banner: <VStack>…</VStack> }`. Accent hexes hardcoded (purple `#8B5CF6`, green `#22C55E`).
- Use SF Symbols (`Image systemName="checkmark.circle.fill"`), not Phosphor, inside widgets.

## Gotchas
- Lifecycle is managed by `@/utils/liveActivityManager` (start/update interval/end + AsyncStorage), **not** here. End activities via `endActivity(taskId)`, not raw factory `.end()` — the latter leaves the update interval running.
- Live Activities run only on a physical device; iOS auto-dismisses after the system TTL.
- Widget canvas sizes are fixed (≈ systemSmall 70×70) — overflow is clipped, no scrolling.
