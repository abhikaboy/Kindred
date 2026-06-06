# api — Agent Guide

Typed API layer: an openapi-fetch client with transparent auth-token refresh, plus one file per backend domain.

## Key files
- `client.ts` — the openapi-fetch client. Mutex-locked token refresh, automatic 401 retry (once), tokens in expo-secure-store.
- `generated/types.ts` — generated from the backend OpenAPI spec. **Do not edit by hand**; regenerate via `bun run generate-types` / `make generate-api`.
- `types.ts` — hand-written interfaces (Task, Workspace, User, …) extending generated schema types.
- `utils.ts` — `withAuthHeaders()` (placeholder Authorization header the interceptor fills in).
- Domain files (`profile.ts`, `activity.ts`, `task.ts`, `rewards.ts`, …) — the exemplar pattern.

## Conventions
- One file per domain; functions are camelCase with an `API` suffix (`markAsCompletedAPI`).
- Type responses via `components["schemas"][...]` from generated types.
- Call as `client.GET/POST/...(path, { params: withAuthHeaders({ ... }) })`.
- API functions **throw** on failure (`new Error(JSON.stringify(error))`); callers (hooks) handle retry/toast. No try/catch here.

## Gotchas
- Don't manage tokens in domain functions — refresh is handled in the client interceptor.
- `(client as any)` casts mark endpoints missing from the spec; prefer regenerating types over widening.
