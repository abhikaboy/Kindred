# Kindred — Agent Guide

Productivity + social app. **Go backend** (Huma v2 + Fiber + MongoDB Atlas) and a **React Native / Expo frontend** (expo-router, TypeScript). A Python **cli** scaffolds backend CRUD; **scripts/** automate builds and codegen.

## Layout
- `frontend/` — Expo app. See [frontend/AGENTS.md](frontend/AGENTS.md).
- `backend/` — Go API. See [backend/AGENTS.md](backend/AGENTS.md).
- `cli/` — Python codegen for backend handlers. See [cli/AGENTS.md](cli/AGENTS.md).
- `scripts/` — build / codegen / pre-commit. See [scripts/AGENTS.md](scripts/AGENTS.md).
- `docs/`, `nix_modules/` — docs and Nix env.

## Global conventions
- **Use `bun`, never `npx`** for JS/TS tooling in this repo.
- **Typed routes only** — expo-router `Href`, never `as any` for navigation targets.
- **Phosphor icons** (`phosphor-react-native`), not Ionicons/vector-icons, in app UI.
- **`ThemedText` semantic types** — never hardcode `fontFamily`/`fontWeight`. Fraunces (500–600, no italic) for headings; Outfit for everything functional.
- **Left-align** layouts by default. Don't pair gray on light-purple tints.
- **Lean comments** — 2 lines max, only when the code genuinely needs the "why".
- **Refactors must not change behavior** — run tests frequently.

## Common commands (root `Makefile`)
- `make dev-backend` / `make dev-frontend` — run each side.
- `make generate-api` — backend OpenAPI → `frontend/api/generated/types.ts` (the FE↔BE type contract).
- `make test-backend` / `make ci-test-short`.
- `make install-hooks` — installs `scripts/pre-commit-hook.sh` (gofmt, vet, fast tests).

## Gotchas
- The repo working tree is shared across concurrent agent sessions — commit often or use a worktree.
- The API type contract is generated; after changing backend request/response shapes, regenerate types (`make generate-api`) so the frontend stays in sync.
