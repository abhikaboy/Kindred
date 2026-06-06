# frontend — Agent Guide

React Native + Expo app (expo-router, TypeScript, react-query). Talks to the Go backend via a generated, typed openapi-fetch client.

## Layout (each has its own AGENTS.md)
- `api/` — typed API client + domain endpoints + generated types.
- `app/` — expo-router routes (route groups: `(logged-in)`, `(onboarding)`, `(tabs)`).
- `components/` — shared UI (theme-aware, `ThemedText`/`ThemedView`).
- `contexts/` — global state providers (tasks, auth-adjacent UI, kudos…).
- `hooks/` — data + side-effect hooks (wrap react-query and the API client).
- `utils/` — analytics, notifications, live activities, logging, helpers.
- `widgets/` — iOS home-screen widgets + Live Activities (expo-widgets / @expo/ui).
- `tasks/` — background task / notification scheduling.
- `constants/` — colors, spacing, subscription + integration config.
- `__tests__/`, `e2e/` — Jest unit tests and end-to-end tests.

## Conventions
- Functional components + hooks only; no class components.
- Theme via `useThemeColor()` (returns an object, not a function): `ThemedColor.primary`.
- Text via `<ThemedText type="..." />`; icons via `phosphor-react-native`.
- Navigation via typed `Href`; route groups use parentheses, dynamic routes `[id].tsx`.

## Commands
- `bun start` / `bun run ios` / `bun run android`
- `bun test` (jest-expo) · `bun run lint` · `bun run format`
- `bun run generate-types` regenerates `api/generated/types.ts` from `api/api-spec.yaml`.

## Gotchas
- `@/` path alias maps to `frontend/`.
- Live Activities only run on a physical iOS device (not the simulator).
- The generated API client may use `as any` for endpoints not yet in the spec — regenerate types rather than widening manually.
