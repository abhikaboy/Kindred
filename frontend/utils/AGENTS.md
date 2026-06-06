# utils — Agent Guide

Cross-cutting helpers: analytics, notifications, Live Activity lifecycle, logging, subscription/feature checks, and pure data transforms.

## Key files
- `analytics.ts` — single PostHog event catalog (`AnalyticsEvents`, 100+ named constants). Add new events here.
- `liveActivityManager.ts` — Live Activity lifecycle: `tryStartActiveTaskActivity`, `tryStartDeadlineActivity`, `isActivityRunning`, `endActivity`. Tracks running activities by `taskId` (in-memory `Map` + AsyncStorage), updates on an interval (5min active / 1min deadline).
- `notificationService.ts` — expo push/local setup, APNs token, Android channels.
- `logger.ts` — leveled logging via `EXPO_PUBLIC_LOG_LEVEL` (defaults NONE in prod).
- `subscription.ts`, `categorySort.ts` — tier/feature checks; pure category sorting.

## Conventions
- Prefer pure functions that don't mutate inputs.
- Centralize constants/enums in one file (analytics events, tab names).

## Gotchas
- `notificationService`: call `initNotificationHandler()` at runtime after boot, **not** at module load (Hermes crash on RN 0.83 + iOS 18).
- `endActivity(taskId)` is the correct teardown — it clears the update interval. Calling factory `.end()` directly leaves the interval running and the activity revives.
- Deadline activities auto-end ~30min past due.
- `categorySort` priority sort is a known no-op, kept bug-for-bug compatible with workspace sorting.
