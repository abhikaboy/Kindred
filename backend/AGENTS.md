# backend — Agent Guide

Go REST API: **Huma v2** (OpenAPI-first) over a **Fiber v2** server, **MongoDB Atlas** for storage. OpenAPI spec is generated and feeds the frontend's typed client.

## Layout
- `cmd/server/` — entrypoint; wires OTel, Sentry, Mongo, Gemini, cron. `--generate-openapi` emits the spec.
- `cmd/db/`, `cmd/seed-test-db/` — migrations (create collections, apply indexes) and test seeding.
- `internal/server/server.go` — route registration + middleware wiring (auth on `/v1/user`, PostHog, request-scoped Sentry). ~25 handler domains.
- `internal/handlers/` — HTTP handlers by domain. See [internal/handlers/AGENTS.md](internal/handlers/AGENTS.md).
- `internal/repository/` — MongoDB data-access layer. See [internal/repository/AGENTS.md](internal/repository/AGENTS.md).
- `internal/jobs/` — cron jobs. See [internal/jobs/AGENTS.md](internal/jobs/AGENTS.md).
- `internal/storage/xmongo/` — Mongo connection + collections map.
- `internal/config/` — env-based config (`caarlos0/env` struct tags).

## The `x*` package convention
`x`-prefixed packages are internal cross-cutting utilities: `xerr` (error responses + Mongo write-exception mapping), `xslog` (slog handler that forwards ERROR+ to Sentry), `xsentry` (request-scoped Sentry hub middleware), `xvalidator` (go-playground validator), `xlog`, and root `xutils` (push notifications).

## Conventions
- Logging: `tint` slog handler in dev; errors auto-forward to Sentry via `xslog`.
- Errors: return `huma.Error4xx*/5xx*` from handlers; never panic (recovery exists but logs+Sentry).
- Config requires dotenv loaded before init; DB name is validated against Atlas at startup.

## Commands (root Makefile)
- `make dev-backend` · `make build-backend` · `make test-backend` / `make ci-test-short`
- `make generate-api` — regenerate the OpenAPI spec + frontend types after changing request/response shapes.

## Gotchas
- SSE streaming routes are registered directly on Fiber and **bypass Huma**.
- Auth middleware only covers the `/v1/user` prefix.
- Request-scoped Sentry hub must be set by middleware before handlers run.
