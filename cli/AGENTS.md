# cli — Agent Guide

Python (typer) CLI that scaffolds backend CRUD handlers and runs one-off DB utilities.

## Key files
- `main.py` — typer commands: `defaultCRUD(name)` / `locationCRUD(name)` generate a `backend/internal/handlers/{name}/` dir with `{name}.go`, `routes.go`, `service.go`, `types.go`; plus utilities like `update_cafe_thumbnails`.
- `util.py` — the code templates (`generate_service/handler/types/routes`) as f-strings.

## Conventions
- Generated layout must match the handler convention in [../backend/internal/handlers/AGENTS.md](../backend/internal/handlers/AGENTS.md).
- Templates hardcode package names/imports — keep them in sync with the real backend structure.

## Gotchas
- Path building uses raw f-string interpolation (no escaping) — pass clean names.
- After scaffolding, the new handler still needs wiring in `internal/server/server.go`.
