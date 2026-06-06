# repository — Agent Guide

Interface-based data-access layer over MongoDB. Handlers/services depend on the interfaces, not the Mongo impl.

## Key files
- `interfaces.go` — repository contracts (e.g. `UserRepository`, ~26 methods).
- `mongo/user_repo.go` — Mongo implementation; `NewUserRepository(coll)` returns the interface.
- `mongo/helpers.go` — generics: `findOneByField[T]`, `findMany[T]`, `updateOneByID` (`$set`).
- `errors.go` — `ErrNotFound`.

## Conventions
- Constructors take a `*mongo.Collection`; methods take `ctx` as first arg.
- `findOneByField` maps `mongo.ErrNoDocuments` → `repository.ErrNotFound` — check for that sentinel, not the driver error.
- Prefer the generic helpers for simple find/update; use explicit filters for atomic ops (e.g. `AtomicMarkTokenUsed`).

## Gotchas
- Generic helpers need the concrete `[T]` type supplied by the caller.
- Keep Mongo-specific logic in `mongo/`; the rest of the app should only see the interface.
