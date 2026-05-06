# Backend Refactor: Auth Consolidation, Task Split, Bulk Dedup, Repository Pattern

**Date:** 2026-05-06
**Scope:** 5 refactors executed in 4 phases via Approach C (interleaved, safe-to-ship increments)
**Constraint:** Purely structural — zero functional changes. Tests run after every meaningful change.

---

## Phase 1: Auth Consolidation

### Problem

The auth package has ~400-500 lines of duplicated code:
- 4 login handlers build identical `SafeUser` responses and token pairs
- 3 registration handlers funnel through `RegisterWithContext` but duplicate OAuth setup
- `middleware.go` and `fiber_middleware.go` contain ~100 lines of identical validation/refresh logic
- 5 `LoginFrom*` service methods each do the same `FindOne` + decode + error check

### Solution: `AuthenticationService` Interface

```go
type AuthenticationService interface {
    // Login flows — all return unified AuthResult
    LoginWithCredentials(ctx context.Context, email, password string) (*AuthResult, error)
    LoginWithPhone(ctx context.Context, phone, password string) (*AuthResult, error)
    LoginWithGoogle(ctx context.Context, googleID string) (*AuthResult, error)
    LoginWithApple(ctx context.Context, appleID string) (*AuthResult, error)
    LoginWithOTP(ctx context.Context, phone string) (*AuthResult, error)

    // Token management
    GenerateTokens(ctx context.Context, userID string, count float64, timezone string) (access string, refresh string, err error)
    ValidateToken(ctx context.Context, token string) (userID string, count float64, timezone string, err error)
    InvalidateTokens(ctx context.Context, userID string) error

    // Registration — single method, optional OAuth provider
    Register(ctx context.Context, req RegisterRequest, provider *OAuthProvider) (*AuthResult, error)

    // OTP
    SendOTP(ctx context.Context, phone string) (string, error)
    VerifyOTP(ctx context.Context, phone, code string) (bool, string, error)

    // Account management
    DeleteAccount(ctx context.Context, userID primitive.ObjectID) error
    AcceptTerms(ctx context.Context, userID primitive.ObjectID, version string) (*time.Time, error)
    UpdatePushToken(ctx context.Context, userID primitive.ObjectID, token string) error
}

// AuthResult — unified return type for all login/register flows
type AuthResult struct {
    AccessToken  string
    RefreshToken string
    User         types.SafeUser
}

// OAuthProvider — optional, passed for Google/Apple registration
type OAuthProvider struct {
    Type string // "google" or "apple"
    ID   string
}
```

### Extraction Details

**1a. `buildSafeUserResponse(user *User) types.SafeUser`**
- New file: `auth/helpers.go`
- Replaces 6 identical 14-field SafeUser construction blocks

**1b. `completeLogin(service, userID, count, user, timezone) (*AuthResult, error)`**
- Shared tail for all `LoginWith*` methods
- Handles: timezone defaulting to UTC, token generation, SafeUser building, AuthResult assembly

**1c. Private `findByField(ctx, field, value) (*User, error)`**
- Internal implementation detail composing the typed public lookups
- Public API stays explicit: `GetUserByEmail`, `GetUserByAppleID`, etc.
- Password-based flows add bcrypt check after the lookup

**1d. Middleware consolidation**
- Extract shared validation + token-refresh logic into a common function
- Thin adapters for HTTP (`middleware.go`) and Fiber (`fiber_middleware.go`)
- Both adapters consume `AuthenticationService` interface

### Files Changed

| File | Change |
|------|--------|
| `auth/helpers.go` | New — `buildSafeUserResponse`, `completeLogin` |
| `auth/service.go` | Refactor to implement `AuthenticationService`, extract `findByField` |
| `auth/auth.go` | Slim down handlers to: validate input, call service, return result |
| `auth/types.go` | Add `AuthResult`, `OAuthProvider`, `AuthenticationService` interface |
| `auth/middleware.go` | Extract shared logic, use thin adapter |
| `auth/fiber_middleware.go` | Extract shared logic, use thin adapter |
| `auth/operations.go` | No changes (Huma operation types stay) |
| `auth/routes.go` | No changes |

---

## Phase 2: Task Service Split

### Problem

`task/service.go` is 2858 lines with 44 methods spanning CRUD, templates, flex tasks, queries, and reminders. `task/task.go` is 1953 lines with 30+ handlers. Both are too large to navigate or reason about.

### Solution: File-Level Split (Same Package)

Split by domain into separate files. The `Service` struct remains the single entry point — this is a **file-only reorganization**, no new structs or constructor changes.

### Service Split

| New file | Methods moved | ~Lines |
|----------|--------------|--------|
| `task_service.go` | Core CRUD: `CreateTask`, `UpdatePartialTask`, `DeleteTask`, `DeleteTaskByID`, `GetTaskByID`, `GetTasksByUser`, `CompleteTask`, `BulkCompleteTask`, `BulkDeleteTask`, `ActivateTask`, `IncrementTaskCompletedAndDelete` + field updates: `UpdateTaskDeadline`, `UpdateTaskStart`, `UpdateTaskReminders`, `UpdateTaskNotes`, `UpdateTaskChecklist` + `verifyCategoryOwnership` | ~800 |
| `template_service.go` | `CreateTemplateTask`, `CreateTemplateForTask`, `CreateTaskFromTemplate`, `DeleteTemplateTask`, `DeleteTaskFromTemplateID`, `UpdateTemplateTask`, `GetTemplateByID`, `GetTemplatesByUserWithCategory`, `GetDueRecurringTasks`, `GetTasksWithStartTimesOlderThanOneDay`, `GetRecurringTasksWithPastDeadlines`, `ScheduleNextRecurrence`, `ResetTemplateMetrics`, `UndoMissedTask` | ~900 |
| `flex_service.go` | `createFlexTemplateForTask`, `createFlexTaskFromTemplate`, `handleFlexCompletion` | ~300 |
| `query_service.go` | `QueryTasksByUser`, `GetCompletedTasks`, `GetCompletedTasksByDate`, `GetActiveTasks`, `GetPublicTasks`, `GetRandomTaskForToday` | ~350 |

**Existing files that stay as-is:** `util.go`, `flex_period*.go`, `checkin.go`, `reminder.go`, `cron.go`, `task_helpers.go`

**Deleted file:** `service.go` (all methods moved to the 4 new files above)

### Handler Split

| New file | Handlers moved |
|----------|---------------|
| `task_handlers.go` | CRUD + field update + completion + status + bulk handlers |
| `template_handlers.go` | All template/recurring handlers |
| `query_handlers.go` | Query + completed tasks handlers |
| `nlp_handlers.go` | All 6 natural language AI handlers |

**Deleted file:** `task.go` (all handlers moved to the 4 new files above)

### Operations Split

| New file | Types moved |
|----------|-------------|
| `task_operations.go` | CRUD + field update + bulk I/O types |
| `template_operations.go` | Template/recurring I/O types |
| `query_operations.go` | Query + completed tasks I/O types |
| `nlp_operations.go` | All NLP I/O types + local Gemini mirror types |

**Deleted file:** `operations.go` (all types moved to the 4 new files above)

---

## Phase 3: Bulk Operation Deduplication

### Problem

`BulkCompleteTask` and `BulkDeleteTask` duplicate ~95% of their single-item counterparts with loop wrappers.

### Solution

Make the single-op the primitive. Bulk becomes a thin iterator + result aggregator:

```go
func (s *Service) BulkCompleteTask(ctx context.Context, userID primitive.ObjectID, tasks []BulkCompleteTaskItem) (*BulkCompleteTaskOutput, error) {
    var results []CompleteTaskResult
    var errs []BulkTaskError
    for _, t := range tasks {
        result, err := s.CompleteTask(ctx, userID, t.ID, t.CategoryID, t.Data)
        if err != nil {
            errs = append(errs, BulkTaskError{ID: t.ID, Err: err})
            continue
        }
        results = append(results, *result)
    }
    return &BulkCompleteTaskOutput{Results: results, Errors: errs}, nil
}
```

Same pattern for `BulkDeleteTask`.

**Caveat:** If current bulk implementations use MongoDB batch operations (`UpdateMany`, `BulkWrite`) for performance, those optimizations stay. Only consolidate where the logic is truly duplicated single-item calls in a loop.

### Files Changed

| File | Change |
|------|--------|
| `task_service.go` | Refactor bulk methods to delegate to single-op methods |

---

## Phase 4: Repository Interfaces + Shared Helpers

### Problem

All services directly use `*mongo.Collection` with string-based lookups. No interfaces, no testability, duplicated query patterns across services.

### Solution

New package `internal/repository/` with typed interfaces and a `mongo/` sub-package for implementation.

### Package Structure

```
internal/repository/
├── interfaces.go         # All repository interfaces
├── errors.go             # Shared errors (ErrNotFound, ErrDuplicate)
└── mongo/
    ├── user_repo.go      # UserRepository implementation
    ├── task_repo.go       # TaskRepository implementation
    ├── template_repo.go   # TemplateTaskRepository implementation
    ├── helpers.go         # Shared private MongoDB helpers
    └── completed_task_repo.go
```

### Interfaces

```go
// interfaces.go

type UserRepository interface {
    GetUserByID(ctx context.Context, id primitive.ObjectID) (*types.User, error)
    GetUserByEmail(ctx context.Context, email string) (*types.User, error)
    GetUserByPhone(ctx context.Context, phone string) (*types.User, error)
    GetUserByGoogleID(ctx context.Context, googleID string) (*types.User, error)
    GetUserByAppleID(ctx context.Context, appleID string) (*types.User, error)
    CreateUser(ctx context.Context, user *types.User) error
    UpdateUser(ctx context.Context, id primitive.ObjectID, update bson.M) error
    DeleteUser(ctx context.Context, id primitive.ObjectID) error
    GetUsersWithPushTokens(ctx context.Context) ([]types.User, error)
    IncrementUserCount(ctx context.Context, id primitive.ObjectID) error
    UpdatePushToken(ctx context.Context, id primitive.ObjectID, token string) error
    CheckTokenCount(ctx context.Context, id primitive.ObjectID) (float64, error)
    MarkTokenUsed(ctx context.Context, id primitive.ObjectID) error
    CheckIfTokenUsed(ctx context.Context, id primitive.ObjectID) (bool, error)
    AcceptTerms(ctx context.Context, id primitive.ObjectID, version string) (*time.Time, error)
}

type TaskRepository interface {
    GetTaskByID(ctx context.Context, taskID, userID primitive.ObjectID) (*types.TaskDocument, error)
    GetTasksByUser(ctx context.Context, userID primitive.ObjectID, sort bson.D) ([]types.TaskDocument, error)
    GetPublicTasks(ctx context.Context, userID primitive.ObjectID, sort bson.D) ([]types.TaskDocument, error)
    CreateTask(ctx context.Context, categoryID primitive.ObjectID, task *types.TaskDocument) (*types.TaskDocument, error)
    UpdateTask(ctx context.Context, taskID, categoryID primitive.ObjectID, update interface{}) error
    DeleteTask(ctx context.Context, categoryID, taskID primitive.ObjectID) error
    UpdateTaskField(ctx context.Context, taskID, categoryID, userID primitive.ObjectID, field string, value interface{}) error
    CompleteTask(ctx context.Context, categoryID, taskID primitive.ObjectID, update bson.M) error
    QueryTasks(ctx context.Context, userID primitive.ObjectID, filters interface{}) ([]types.TaskDocument, error)
    GetCompletedTasks(ctx context.Context, userID primitive.ObjectID, page, limit int) ([]types.TaskDocument, int64, error)
    GetCompletedTasksByDate(ctx context.Context, userID primitive.ObjectID, date time.Time) ([]types.TaskDocument, error)
    GetActiveTasks(ctx context.Context, userID primitive.ObjectID) ([]types.TaskDocument, error)
}

type TemplateTaskRepository interface {
    GetTemplateByID(ctx context.Context, id primitive.ObjectID) (*types.TemplateTaskDocument, error)
    CreateTemplate(ctx context.Context, template *types.TemplateTaskDocument) (*types.TemplateTaskDocument, error)
    UpdateTemplate(ctx context.Context, id primitive.ObjectID, update interface{}) error
    DeleteTemplate(ctx context.Context, id primitive.ObjectID) error
    GetDueRecurringTasks(ctx context.Context) ([]types.TemplateTaskDocument, error)
    GetTemplatesByUser(ctx context.Context, userID primitive.ObjectID) ([]types.TemplateTaskDocument, error)
    GetTasksWithOldStartTimes(ctx context.Context, userIDs ...primitive.ObjectID) ([]types.TemplateTaskDocument, error)
    GetRecurringWithPastDeadlines(ctx context.Context, userIDs ...primitive.ObjectID) ([]types.TemplateTaskDocument, error)
    ResetMetrics(ctx context.Context, id primitive.ObjectID) error
}
```

### Shared Private Helpers (`mongo/helpers.go`)

```go
func findOneByField[T any](ctx context.Context, coll *mongo.Collection, field string, value any) (*T, error)
func findMany[T any](ctx context.Context, coll *mongo.Collection, filter bson.M, opts ...*options.FindOptions) ([]T, error)
func updateOneByID(ctx context.Context, coll *mongo.Collection, id primitive.ObjectID, update bson.M) error
func pushToArray(ctx context.Context, coll *mongo.Collection, docID primitive.ObjectID, arrayField string, element any) error
```

These are private to the `mongo` sub-package. Public API is always the typed repository methods (e.g. `GetUserByEmail`, not `findOneByField`).

### Migration Scope

- **Phase 4 migrates:** auth service + task service only
- **Out of scope:** post, connection, profile, category, and other services stay on raw collections
- Services receive repository interfaces via constructor injection
- Existing `newService(collections)` pattern changes to `newService(repos)` for migrated services

### Service Constructor Changes

```go
// Before (auth)
func newService(collections map[string]*mongo.Collection, config config.Config) *Service

// After (auth)
func newService(users repository.UserRepository, config config.Config) *Service

// Before (task)
func newService(collections map[string]*mongo.Collection) *Service

// After (task)
func newService(tasks repository.TaskRepository, templates repository.TemplateTaskRepository, users repository.UserRepository) *Service
```

Routes functions create the concrete MongoDB repos and pass them in.

---

## Execution Order & Test Strategy

| Phase | Scope | Test checkpoint |
|-------|-------|-----------------|
| 1 | Auth consolidation | Run `go test ./internal/handlers/auth/...` after each extraction |
| 2 | Task file split | Run `go test ./internal/handlers/task/...` after each file move |
| 3 | Bulk dedup | Run `go test ./internal/handlers/task/...` after refactoring each bulk method |
| 4 | Repository interfaces | Run `go test ./...` after migrating each service |

Each phase is independently shippable as its own PR/commit.

---

## Out of Scope

- Query builders
- Caching layer
- Migrating services other than auth and task to repositories
- Changing any API behavior, request/response shapes, or route paths
- Adding new tests (existing tests must continue to pass)
- Refactoring the Gemini/AI integration
- Completing the Huma migration for sockets
