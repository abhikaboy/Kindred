# hooks — Agent Guide

React hooks bridging the API layer and UI: data fetching (react-query), auth, caching, and per-screen state.

## Key files
- `useTypedAPI.tsx` — typed react-query hooks (`useTypedQuery`, `useTypedMutation`, `useTypedSuspenseQuery`) over the openapi-fetch client. Prefer this for new data fetching.
- `useAuth.tsx` — `AuthProvider` + `useAuth()`; login (Apple/Google/Phone/OTP), token refresh, 401 logout. `fetchAuthData()` is rate-limited to ≥2000ms between calls.
- `useTaskCompletion.tsx` — central task-completion path (every completion route funnels through it: swipe, detail button, live-activity deep link). Ends Live Activities here.
- `useNotifications.tsx` — react-query wrapper with optimistic `markAsRead` updates.
- `useApiCache.ts` — timestamp-based AsyncStorage caching.
- `useRequest.tsx` — legacy dual-path (axios `request()` vs typed `typedRequest()`); prefer typed.

## Conventions
- `use`-prefixed camelCase; return `{ data, loading, error, refetch }`-style objects.
- react-query retries with exponential backoff; surface errors via toast.
- Guard async effects with a `cancelled` flag; wrap callbacks in refs for stable identity.

## Gotchas
- Optimistic updates (notifications) don't roll back on error — they rely on retry.
- `useAuth` compares stored vs request token to avoid double-logout on concurrent 401s.
