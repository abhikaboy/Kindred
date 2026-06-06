# scripts — Agent Guide

Build, codegen, and git-hook automation. Mostly invoked via the root `Makefile`.

## Key files
- `generate-api-types.sh` — builds the backend, emits the OpenAPI spec (`server --generate-openapi`), then runs `openapi-typescript` into `frontend/api/generated/types.ts`. Prefers the Nix env; falls back to a plain shell. Run via `make generate-api`.
- `pre-commit-hook.sh` — `gofmt -l`, `go vet`, `go test -short`; warns on TODO/FIXME and stray `fmt.Println`. Install via `make install-hooks`.

## Conventions
- Scripts are `set -e` (fail-fast) — one failed step aborts the rest.
- Frontend tooling assumes `bun`.

## Gotchas
- `generate-api-types.sh` is the source of truth for the FE↔BE type contract — run it after backend DTO changes.
- Pre-commit only runs fast (`-short`) tests; it is not a substitute for `make test-backend`.
