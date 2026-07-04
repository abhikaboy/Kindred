# Planner: Week-First Calendar Page Redesign

**Date:** 2026-07-04
**Route:** `app/(logged-in)/(tabs)/(task)/daily.tsx`
**Status:** Approved (mockups reviewed in visual companion; tray option A selected)

## Goal

The calendar page exists so users can schedule and see their tasks in a **time-based model** rather than the semantic workspace model the rest of the app uses. User feedback: a weekly/monthly overview matters more than the daily view, which today is the only view. The redesign makes Week the default, adds a real Month view, demotes the day views to a drill-down, and makes scheduling unplanned tasks a first-class drag gesture.

## What the page becomes

Three levels, one route:

1. **Week (default)** — month header (`‹ July 2026 ›`, chevrons step a week), a `[Week | Month]` segmented control, a 7-day strip with per-day workspace-colored density dots (today ringed, selected filled), the selected day's agenda below, and a persistent **Unscheduled tray** pinned to the bottom.
2. **Month** — same header (chevrons step a month), a month grid where each cell shows the date, up to 3 workspace-colored dots, and a muted `+N` overflow count. Tapping a cell switches to Week with that day selected. Cells are drop targets for the tray.
3. **Day timeline (drill-down)** — the existing hour-grid `CalendarView` with drag-to-create, reached from a `Timeline` button on the agenda's day header. Back returns to Week. Unchanged internally.

## Scheduling: the unscheduled tray

- Persistent bottom tray in **both** Week and Month (user-selected option A): a horizontally scrollable row of chips, one per unscheduled task, labeled `UNSCHEDULED · N`.
- **Drag a chip onto a week-strip day or a month cell → sets that task's deadline to that date** via the existing specialized deadline endpoint in `api/task.ts` (`updateTaskDeadline`-style call, midnight default; no modal round-trip). Optimistic update; on failure, toast + revert.
- Drop targets highlight while a drag is live (dashed primary border, tinted background — as mocked).
- Long-press a chip also offers the existing quick-schedule modal path (`Screen.DEADLINE`) for picking a time, matching `onQuickSchedule` behavior in the current list view.
- **Discoverability hint:** until the user completes their first drag-schedule, a one-line caption sits under the tray: "Drag a task onto a day to schedule it." Dismissed permanently after the first successful drop (AsyncStorage flag `planner_drag_hint_done`). No tooltip/coach-mark machinery.

## Reuse (hard requirement)

| Piece | Reuses |
| --- | --- |
| Segmented control | `components/ui/SegmentedControl` (as in settings) |
| Agenda | `components/daily/TaskListView` unchanged (incl. overdue/upcoming/unscheduled sections and `SwipableTaskCard`) |
| Day timeline | `components/daily/CalendarView` + `ScheduleTaskSheet` unchanged |
| Month grid visual pattern | follow `components/profile/MemoriesCalendar` / `components/activity/CalendarMonth` grid conventions |
| Drag hit-testing | generalize `utils/dragHitTest.ts` (`categoryAtPoint` → rect-at-point over day cells); correct for live scroll offset per the known stale-rect gotcha |
| Data | `hooks/useDailyTasks` for the selected day; new `useTaskCountsByDay(start, end)` derived from the same tasks source for strip dots + month cells |
| Text/theme | `ThemedText` semantic types, `useThemeColor` tokens only — no hardcoded colors/fonts |

Google Calendar events already sync in as tasks, so they appear in dots, agenda, and timeline with no extra work.

## New components (all in `components/daily/`)

- `WeekStrip` — 7 `DayCell`s, swipe/chevron paging, density dots, drop-target registration.
- `MonthGrid` — grid of `DayCell`-style cells with dots/overflow, tap-to-week, drop-target registration.
- `UnscheduledTray` — chips row + hint line + drag source.
- `PlannerHeader` — month label, chevrons (week- or month-stepping by mode), segmented control.

## Deleted

- `DateNavBar` (day stepper) — replaced by `PlannerHeader` + `WeekStrip`.
- `CalendarPickerOverlay` — the Month view is the date picker now.
- `FloatingViewToggle` — replaced by the segmented control + `Timeline` button.

(`components/daily/DatePager.tsx` belongs to the feed and is untouched.)

## Out of scope

- 7-column week time grid (rejected in favor of strip + agenda).
- Remember-last-view persistence (Week is always the default).
- Any backend change — client-side reads and the existing deadline-update endpoint only.
- Start-date scheduling via drag (drag sets deadline; start dates stay on the quick-schedule modal path).

## Testing

- Unit: `useTaskCountsByDay` bucketing (timezone/midnight edges); drag rect hit-testing over a scrolled month grid (extend the existing `dragHitTest` test).
- Manual: drag-schedule from tray in both views, optimistic failure revert, hint disappears after first drop, month↔week↔timeline navigation, `params.workspace === "Calendar"` deep link still lands on the timeline.
