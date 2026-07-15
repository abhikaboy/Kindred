# app — Agent Guide

expo-router file-based routes. Folder structure == navigation structure.

## Key files
- `_layout.tsx` — root layout: all providers (Auth, Tasks, bottom-sheet, portals, Sentry), font loading (Outfit / Fraunces / SofiaSans), QueryClient.
- `index.tsx` — auth gate; first launch → `/intro` (video), otherwise → `/login`. Don't change without updating the auth flow.
- `(logged-in)/_layout.tsx` — protected layout; render-blocking during auth init. Owns push-notification handling, deep-link routing (`getNotificationRoute()`, 15+ `NotificationType`s), widget updates, and Live Activity triggers.
- `(logged-in)/(tabs)/_layout.tsx` — 5-tab bar (Tasks, Feed, Search, Activity, Profile) with Phosphor icons.
- `(onboarding)/` — signup flow (phone/name/password → welcome → tutorial → calendar). Pre-login intro is the `/intro` video, not here.

## Conventions
- Route groups in parens: `(logged-in)`, `(tabs)`, `(task)`; comma-groups `(feed,search,profile)` share a stack.
- Dynamic routes `[id].tsx`, `[action].tsx`. Query params like `?categoryId=X&name=Y`.
- Navigate with typed `Href` only.

## Gotchas
- Adding a push type means updating both the `NotificationType` union and `getNotificationRoute()`.
- Live Activities are started from push handlers via `tryStart*Activity` in `@/utils/liveActivityManager`, and ended on completion via `useTaskCompletion`.
- `widgetURL()` deep links use full group paths: `kindred:///(logged-in)/(tabs)/(task)/task/{id}`.
