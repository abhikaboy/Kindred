# scripts — Agent Guide

Build, codegen, and git-hook automation. Mostly invoked via the root `Makefile`.

## Key files
- `generate-api-types.sh` — builds the backend, emits the OpenAPI spec (`server --generate-openapi`), then runs `openapi-typescript` into `frontend/api/generated/types.ts`. Prefers the Nix env; falls back to a plain shell. Run via `make generate-api`.
- `bump-version.sh` — bumps the iOS build number stored on EAS (remote version source) by driving `eas build:version:set` with `expect`; `--version X.Y.Z` also sets the marketing version in `app.json`, `package.json`, `Info.plist`, and the Xcode project. Run via `make bump-version [VERSION=...]`.
- `pre-commit-hook.sh` — `gofmt -l`, `go vet`, `go test -short`; warns on TODO/FIXME and stray `fmt.Println`. Install via `make install-hooks`.

## Conventions
- Scripts are `set -e` (fail-fast) — one failed step aborts the rest.
- Frontend tooling assumes `bun`.

## Gotchas
- `generate-api-types.sh` is the source of truth for the FE↔BE type contract — run it after backend DTO changes.
- Pre-commit only runs fast (`-short`) tests; it is not a substitute for `make test-backend`.
- `notioly.py` — extracts Notioly illustrations from `~/Downloads/notioly` into `frontend/assets/images/notioly/<set>/` and regenerates the `index.ts` registry. See `.claude/skills/notioly/SKILL.md`.
