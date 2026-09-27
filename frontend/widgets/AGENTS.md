# widgets — Agent Guide

iOS home/lock screen widgets and Live Activities.

- **Widgets render natively** in SwiftUI (`ios/ExpoWidgetsTarget/*.swift`). expo-widgets is only the transport: JS writes timeline props to the shared app group, the Swift `KindredProvider` reads them.
- **Live Activities** are still written in the `@expo/ui/swift-ui` DSL (`ActiveTaskActivity.tsx`, `DeadlineCountdownActivity.tsx`), because expo-widgets owns their ActivityKit attributes.

## Key files
- `widgetData.ts` — pure builders for every widget payload. The Swift `Codable` structs in `KindredWidgetKit.swift` mirror these types; change both together. Tested in `__tests__/widgetData.test.ts`.
- `syncWidgets.ts` — the only thing that pushes widget data: `syncTaskWidgets` (from `tasksContext`), `syncStreakWidgets` / `refreshCompletedToday` (logged-in layout, on launch + foreground), `noteTaskCompleted` (every completion, via `taskCompletionEvents`).
- `nativeWidgets.tsx` — `createWidget` registrations; their layouts are never shown.
- `widgetUpdaters.ts` — lazy singletons so `@expo/ui` native modules don't load at bundle eval. Always go through these.
- `ios/ExpoWidgetsTarget/KindredWidgetKit.swift` — palette, provider, shared rows/rings, gallery sample data.

## Conventions
- Match the app design system: `#854DFF` accent, `#0C0C1A` dark surface (white in light), `#FF5C5F` overdue, Outfit type kept light (bundled; weights by instance name `Outfit-Thin_<Weight>`), no serif, no gradients. Brand accents come from the circle/triangle/diamond motif, used sparingly and differently per surface. No emojis; SF Symbols in native/DSL code.
- Check widget layouts by rendering the SwiftUI views offscreen (build with `-D WIDGET_RENDER` so `TaskLink` skips `Link`) rather than guessing.
- Payloads must not contain `null`/`undefined` (UserDefaults rejects them) — omit the key instead.
- Deadline-driven state (overdue, next task) is precomputed as timeline entries in JS and re-checked against the render date in Swift, so widgets stay right with the app closed.
- DSL files start with `'widget';` and keep everything inside the component function (it is stringified and evaluated natively).

## Gotchas
- Live Activity lifecycle lives in `@/utils/liveActivityManager`. End via `endActivity(taskId)`. It re-attaches to native activities after relaunch; one activity per type at a time.
- Teardown rules: `dismissActivity` (Dismiss button) blocks scheduler restarts until a user-initiated start; `reconcileActivities` (run by `useLiveActivityScheduler`) ends activities for completed/deleted tasks, changed deadlines, >30 min overdue, and treats lock-screen swipes as dismissals.
- `markAsCompletedAPI` emits `taskCompletionEvents`; the logged-in layout ends the task's activity and updates widgets there. Don't duplicate that per screen.
- `expo prebuild` would regenerate `ios/ExpoWidgetsTarget` from the expo-widgets plugin and wipe the native widgets. The `ios/` folder is committed and EAS builds from it; don't prebuild.
- Native widget code is new files → register them in `project.pbxproj` for the `ExpoWidgetsTarget` target.
- Never put `fixedSize` on a `dateStyle="timer"` Text in a Live Activity: it crashes WidgetRenderer_Activities in a loop (layout assertion). Pin timers with `frame({ maxWidth, alignment: 'leading' })` instead.
- Fire test activities with `xcrun simctl openurl booted "kindred:///dev-live-activity?type=soon"` (`active|upcoming|soon|overdue|end`; dev builds only).
- Live Activities show on simulators, but test tap-to-complete on a device.
