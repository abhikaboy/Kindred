# handlers — Agent Guide

HTTP handlers, one folder per domain (auth, task, post, category, group, rings, notifications, calendar, subscription, …). Built on Huma operations.

## Per-domain file layout
```
{domain}/
  routes.go          — registers operations, constructs service + Handler
  {domain}_handlers.go   — handler methods: (ctx, *Input) -> (*Output, error)
  operations.go      — huma.Register(api, huma.Operation{...}, handler.Method)
  {domain}_service.go    — business logic + Mongo queries
  types.go           — request/response DTOs (Input/Output embed a body struct)
  tests/             — handler tests
```

## Conventions
- Extract the caller via `auth.RequireAuth(ctx)`.
- Return errors as `huma.Error4xxBadRequest(...)` / `huma.Error500InternalServerError(...)`.
- Mongo sorting via `bson.D` with `1`/`-1`.
- `routes.Routes()` calls `newService()`, builds the `Handler`, then `RegisterXyzOperations()`.

## Gotchas
- New endpoints must be registered in the domain's `operations.go` **and** wired in `internal/server/server.go`.
- After changing any Input/Output shape, run `make generate-api` so the frontend types update.
- The CLI (`cli/`) scaffolds this exact 4-file layout — match it for consistency.
