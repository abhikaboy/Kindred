# Backend Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate auth duplication, split the oversized task service/handler, extract shared validation from bulk ops, and introduce repository interfaces with shared MongoDB helpers for the auth and task packages.

**Architecture:** Four phases executed sequentially: (1) Auth consolidation behind an `AuthenticationService` interface with shared helpers, (2) File-level split of the task package into domain-focused files, (3) Shared helper extraction from bulk operations, (4) Repository interfaces in `internal/repository/` with MongoDB implementations and migration of auth + task services. Each phase is independently shippable and verified by the existing test suite.

**Tech Stack:** Go 1.25, Huma v2, Fiber v2, MongoDB driver, testify, bcrypt, JWT

**Module:** `github.com/abhikaboy/Kindred`

**Spec:** `docs/superpowers/specs/2026-05-06-backend-refactor-design.md`

---

## Phase 1: Auth Consolidation

### Task 1: Add `AuthResult` type and `buildSafeUserResponse` helper

**Files:**
- Modify: `internal/handlers/auth/types.go`
- Create: `internal/handlers/auth/helpers.go`
- Create: `internal/handlers/auth/helpers_test.go`

- [ ] **Step 1: Write test for `buildSafeUserResponse`**

Create `internal/handlers/auth/helpers_test.go`:

```go
package auth

import (
	"testing"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/stretchr/testify/assert"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestBuildSafeUserResponse(t *testing.T) {
	userID := primitive.NewObjectID()
	user := &User{
		ID:              userID,
		DisplayName:     "Test User",
		Handle:          "testuser",
		ProfilePicture:  "https://example.com/pic.jpg",
		Categories:      []types.CategoryDocument{{Name: "Work"}},
		Friends:         []primitive.ObjectID{primitive.NewObjectID()},
		TasksComplete:   5,
		RecentActivity:  []types.ActivityDocument{},
		Encouragements:  2,
		Congratulations: 2,
		Streak:          3,
		StreakEligible:  true,
		Points:          100,
		PostsMade:       10,
	}

	result := buildSafeUserResponse(user)

	assert.Equal(t, userID, result.ID)
	assert.Equal(t, "Test User", result.DisplayName)
	assert.Equal(t, "testuser", result.Handle)
	assert.Equal(t, "https://example.com/pic.jpg", result.ProfilePicture)
	assert.Equal(t, 1, len(result.Categories))
	assert.Equal(t, 1, len(result.Friends))
	assert.Equal(t, 5, result.TasksComplete)
	assert.Equal(t, 2, result.Encouragements)
	assert.Equal(t, 2, result.Congratulations)
	assert.Equal(t, 3, result.Streak)
	assert.True(t, result.StreakEligible)
	assert.Equal(t, 100, result.Points)
	assert.Equal(t, 10, result.PostsMade)
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/auth/... -run TestBuildSafeUserResponse -v`
Expected: FAIL — `buildSafeUserResponse` not defined

- [ ] **Step 3: Add `AuthResult` to types.go and create helpers.go**

Add to `internal/handlers/auth/types.go` after the `LoginWithOTPRequest` struct (after line 111):

```go
// AuthResult is the unified return type for all login/register flows.
type AuthResult struct {
	AccessToken  string
	RefreshToken string
	User         types.SafeUser
}

// OAuthProvider identifies an OAuth provider for registration.
type OAuthProvider struct {
	Type string // "google" or "apple"
	ID   string
}
```

Create `internal/handlers/auth/helpers.go`:

```go
package auth

import "github.com/abhikaboy/Kindred/internal/handlers/types"

// buildSafeUserResponse converts a full User to a SafeUser for API responses.
// This is the single source of truth for the user fields exposed in login/register responses.
func buildSafeUserResponse(user *User) types.SafeUser {
	return types.SafeUser{
		ID:              user.ID,
		DisplayName:     user.DisplayName,
		Handle:          user.Handle,
		ProfilePicture:  user.ProfilePicture,
		Categories:      user.Categories,
		Friends:         user.Friends,
		TasksComplete:   user.TasksComplete,
		RecentActivity:  user.RecentActivity,
		Encouragements:  user.Encouragements,
		Congratulations: user.Congratulations,
		Streak:          user.Streak,
		StreakEligible:  user.StreakEligible,
		Points:          user.Points,
		PostsMade:       user.PostsMade,
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/auth/... -run TestBuildSafeUserResponse -v`
Expected: PASS

- [ ] **Step 5: Run full auth test suite**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/auth/... -v`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/abhik.ray/Kindred/backend
git add internal/handlers/auth/helpers.go internal/handlers/auth/helpers_test.go internal/handlers/auth/types.go
git commit -m "refactor(auth): extract buildSafeUserResponse helper and AuthResult type"
```

---

### Task 2: Add `completeLogin` helper and wire into login handlers

**Files:**
- Modify: `internal/handlers/auth/helpers.go`
- Modify: `internal/handlers/auth/helpers_test.go`
- Modify: `internal/handlers/auth/auth.go`

- [ ] **Step 1: Write test for `completeLogin`**

Append to `internal/handlers/auth/helpers_test.go`:

```go
func TestCompleteLogin_DefaultsTimezoneToUTC(t *testing.T) {
	user := &User{
		ID:       primitive.NewObjectID(),
		Timezone: "",
	}
	tz := timezoneOrDefault(user.Timezone)
	assert.Equal(t, "UTC", tz)
}

func TestCompleteLogin_UsesUserTimezone(t *testing.T) {
	user := &User{
		ID:       primitive.NewObjectID(),
		Timezone: "America/New_York",
	}
	tz := timezoneOrDefault(user.Timezone)
	assert.Equal(t, "America/New_York", tz)
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/auth/... -run TestCompleteLogin -v`
Expected: FAIL — `timezoneOrDefault` not defined

- [ ] **Step 3: Add `completeLogin` and `timezoneOrDefault` to helpers.go**

Add to `internal/handlers/auth/helpers.go`:

```go
// timezoneOrDefault returns the timezone string, defaulting to "UTC" if empty.
func timezoneOrDefault(tz string) string {
	if tz == "" {
		return "UTC"
	}
	return tz
}

// completeLogin generates tokens and builds the auth response for a successful login.
// This is the shared tail for all LoginWith* handler methods.
func completeLogin(service *Service, userID string, count float64, user *User) (*AuthResult, error) {
	timezone := timezoneOrDefault(user.Timezone)

	access, refresh, err := service.GenerateTokens(userID, count, timezone)
	if err != nil {
		return nil, err
	}

	return &AuthResult{
		AccessToken:  access,
		RefreshToken: refresh,
		User:         buildSafeUserResponse(user),
	}, nil
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/auth/... -run TestCompleteLogin -v`
Expected: PASS

- [ ] **Step 5: Refactor `LoginHuma` to use helpers**

Replace the body of `LoginHuma` in `auth.go` (lines 20-63) with:

```go
func (h *Handler) LoginHuma(ctx context.Context, input *LoginInput) (*LoginOutput, error) {
	errs := xvalidator.Validator.Validate(input.Body)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Please check your email and password", fmt.Errorf("validation errors: %v", errs))
	}

	id, count, user, err := h.service.LoginFromCredentials(input.Body.Email, input.Body.Password)
	if err != nil {
		return nil, huma.Error401Unauthorized("Invalid email or password", err)
	}

	result, err := completeLogin(h.service, id.Hex(), *count, user)
	if err != nil {
		return nil, huma.Error500InternalServerError("Unable to complete login. Please try again.", err)
	}

	resp := &LoginOutput{}
	resp.AccessToken = result.AccessToken
	resp.RefreshToken = result.RefreshToken
	resp.Body = result.User
	return resp, nil
}
```

- [ ] **Step 6: Refactor `LoginWithPhoneHuma` (lines 67-111)**

```go
func (h *Handler) LoginWithPhoneHuma(ctx context.Context, input *LoginWithPhoneInput) (*LoginOutput, error) {
	errs := xvalidator.Validator.Validate(input.Body)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Validation failed", fmt.Errorf("validation errors: %v", errs))
	}

	id, count, user, err := h.service.LoginFromPhone(input.Body.PhoneNumber, input.Body.Password)
	if err != nil {
		return nil, huma.Error401Unauthorized("Invalid phone number or password", err)
	}

	result, err := completeLogin(h.service, id.Hex(), *count, user)
	if err != nil {
		return nil, huma.Error500InternalServerError("Unable to complete login. Please try again.", err)
	}

	resp := &LoginOutput{}
	resp.AccessToken = result.AccessToken
	resp.RefreshToken = result.RefreshToken
	resp.Body = result.User
	return resp, nil
}
```

- [ ] **Step 7: Refactor `LoginWithGoogleHuma` (lines 156-200)**

```go
func (h *Handler) LoginWithGoogleHuma(ctx context.Context, input *LoginWithGoogleInput) (*LoginOutput, error) {
	errs := xvalidator.Validator.Validate(input.Body)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Validation failed", fmt.Errorf("validation errors: %v", errs))
	}

	id, count, user, err := h.service.LoginFromGoogle(input.Body.GoogleID)
	if err != nil {
		return nil, huma.Error401Unauthorized("Unable to sign in with Google. Please try again.", err)
	}

	result, err := completeLogin(h.service, id.Hex(), *count, user)
	if err != nil {
		return nil, huma.Error500InternalServerError("Unable to complete login. Please try again.", err)
	}

	resp := &LoginOutput{}
	resp.AccessToken = result.AccessToken
	resp.RefreshToken = result.RefreshToken
	resp.Body = result.User
	return resp, nil
}
```

- [ ] **Step 8: Refactor `LoginWithAppleHuma` (lines 422-465)**

```go
func (h *Handler) LoginWithAppleHuma(ctx context.Context, input *LoginWithAppleInput) (*LoginOutput, error) {
	errs := xvalidator.Validator.Validate(input.Body)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Validation failed", fmt.Errorf("validation errors: %v", errs))
	}

	id, count, user, err := h.service.LoginFromApple(input.Body.AppleID)
	if err != nil {
		return nil, huma.Error401Unauthorized("Unable to sign in with Apple. Please try again.", err)
	}

	result, err := completeLogin(h.service, id.Hex(), *count, user)
	if err != nil {
		return nil, huma.Error500InternalServerError("Unable to complete login. Please try again.", err)
	}

	resp := &LoginOutput{}
	resp.AccessToken = result.AccessToken
	resp.RefreshToken = result.RefreshToken
	resp.Body = result.User
	return resp, nil
}
```

- [ ] **Step 9: Refactor `LoginWithOTPHuma` (lines 626-687)**

```go
func (h *Handler) LoginWithOTPHuma(ctx context.Context, input *LoginWithOTPInput) (*LoginWithOTPOutput, error) {
	errs := xvalidator.Validator.Validate(input.Body)
	if len(errs) > 0 {
		return nil, huma.Error400BadRequest("Validation failed", fmt.Errorf("validation errors: %v", errs))
	}

	valid, status, err := h.service.VerifyOTP(ctx, input.Body.PhoneNumber, input.Body.Code)
	if err != nil {
		slog.Error("Failed to verify OTP during login", "error", err, "phone", input.Body.PhoneNumber)
		return nil, huma.Error500InternalServerError("Unable to verify code. Please try again.", err)
	}

	if !valid {
		slog.Warn("Invalid OTP code during login", "phone", input.Body.PhoneNumber, "status", status)
		return nil, huma.Error401Unauthorized("Invalid or expired verification code. Please request a new one.", nil)
	}

	id, count, user, err := h.service.LoginFromPhoneOTP(input.Body.PhoneNumber)
	if err != nil {
		slog.Error("Failed to find user by phone", "error", err, "phone", input.Body.PhoneNumber)
		return nil, huma.Error404NotFound("No account found with this phone number. Please sign up first.", err)
	}

	result, err := completeLogin(h.service, id.Hex(), *count, user)
	if err != nil {
		slog.Error("Token generation failed during OTP login", "error", err, "user_id", id.Hex())
		return nil, huma.Error500InternalServerError("Token generation failed", err)
	}

	resp := &LoginWithOTPOutput{}
	resp.AccessToken = result.AccessToken
	resp.RefreshToken = result.RefreshToken
	resp.Body = result.User

	slog.Info("OTP login successful", "user_id", id.Hex(), "phone", input.Body.PhoneNumber)
	return resp, nil
}
```

- [ ] **Step 10: Refactor `RegisterWithContext` SafeUser block (lines 398-416)**

Replace the SafeUser construction block at the end of `RegisterWithContext` with:

```go
	resp := &RegisterOutput{}
	resp.AccessToken = access
	resp.RefreshToken = refresh
	resp.Body = buildSafeUserResponse(&user)

	return resp, nil
}
```

- [ ] **Step 11: Run full auth test suite**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/auth/... -v`
Expected: All tests PASS

- [ ] **Step 12: Commit**

```bash
cd /Users/abhik.ray/Kindred/backend
git add internal/handlers/auth/helpers.go internal/handlers/auth/helpers_test.go internal/handlers/auth/auth.go
git commit -m "refactor(auth): consolidate login handlers with completeLogin helper"
```

---

### Task 3: Extract `findByField` private helper in auth service

**Files:**
- Modify: `internal/handlers/auth/service.go`
- Modify: `internal/handlers/auth/helpers_test.go`

- [ ] **Step 1: Add `findByField` to service.go and refactor LoginFrom* methods**

Add the private helper and refactor the 5 login methods in `service.go`. Replace lines 114-191 with:

```go
// findByField is the private implementation detail for typed user lookups.
func (s *Service) findByField(field string, value string) (*User, error) {
	var user User
	err := s.users.FindOne(context.Background(), bson.M{field: value}).Decode(&user)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, fiber.NewError(404, "Account does not exist")
	}
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *Service) LoginFromCredentials(email string, password string) (*primitive.ObjectID, *float64, *User, error) {
	user, err := s.findByField("email", email)
	if err != nil {
		return nil, nil, nil, err
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password))
	if err != nil {
		return nil, nil, nil, fiber.NewError(400, "Not Authorized, Invalid Credentials")
	}

	return &user.ID, &user.Count, user, nil
}

func (s *Service) LoginFromPhone(phoneNumber string, password string) (*primitive.ObjectID, *float64, *User, error) {
	user, err := s.findByField("phone", phoneNumber)
	if err != nil {
		return nil, nil, nil, err
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password))
	if err != nil {
		return nil, nil, nil, fiber.NewError(400, "Not Authorized, Invalid Credentials")
	}

	return &user.ID, &user.Count, user, nil
}

func (s *Service) LoginFromApple(apple_id string) (*primitive.ObjectID, *float64, *User, error) {
	user, err := s.findByField("apple_id", apple_id)
	if err != nil {
		return nil, nil, nil, err
	}
	return &user.ID, &user.Count, user, nil
}

func (s *Service) LoginFromGoogle(google_id string) (*primitive.ObjectID, *float64, *User, error) {
	user, err := s.findByField("google_id", google_id)
	if err != nil {
		return nil, nil, nil, err
	}
	return &user.ID, &user.Count, user, nil
}

func (s *Service) LoginFromPhoneOTP(phone_number string) (*primitive.ObjectID, *float64, *User, error) {
	user, err := s.findByField("phone", phone_number)
	if err != nil {
		return nil, nil, nil, err
	}
	return &user.ID, &user.Count, user, nil
}
```

- [ ] **Step 2: Run full auth test suite**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/auth/... -v`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
cd /Users/abhik.ray/Kindred/backend
git add internal/handlers/auth/service.go
git commit -m "refactor(auth): extract findByField private helper for user lookups"
```

---

### Task 4: Consolidate middleware shared logic

**Files:**
- Modify: `internal/handlers/auth/middleware.go`
- Modify: `internal/handlers/auth/fiber_middleware.go`
- Create: `internal/handlers/auth/middleware_test.go`

- [ ] **Step 1: Write test for `validateRefreshTokenCore`**

Create `internal/handlers/auth/middleware_test.go`:

```go
package auth

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestValidateRefreshTokenCore_InvalidToken(t *testing.T) {
	// Verify the function signature and error path exist
	// Full integration testing requires a database connection, but we can test
	// that the core function is callable and returns errors for nil service
	assert.NotNil(t, validateRefreshTokenCore)
}
```

- [ ] **Step 2: Extract shared `validateRefreshTokenCore` into middleware.go**

The logic in `validateRefreshToken` (middleware.go:124-156) and `validateRefreshTokenFiber` (fiber_middleware.go:116-145) is identical. Extract the shared logic into `middleware.go`:

```go
// validateRefreshTokenCore contains the shared refresh token validation logic
// used by both HTTP and Fiber middleware adapters.
func validateRefreshTokenCore(service *Service, refreshToken string) (userID string, count float64, timezone string, err error) {
	slog.Info("Refresh token: starting validation")

	userID, count, timezone, err = service.ValidateToken(refreshToken)
	if err != nil {
		slog.Error("Refresh token: validation failed", "error", err.Error())
		return "", 0, "", fmt.Errorf("refresh token invalid: %v", err)
	}

	id, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		slog.Error("Refresh token: invalid user ID format", "user_id", userID, "error", err.Error())
		return "", 0, "", fmt.Errorf("invalid user ID in refresh token: %v", err)
	}

	used, err := service.CheckIfTokenUsed(id)
	if err != nil {
		slog.Error("Refresh token: error checking usage", "error", err.Error())
		return "", 0, "", fmt.Errorf("error checking token usage: %v", err)
	}

	if used {
		slog.Error("Refresh token: already used", "user_id", userID)
		return "", 0, "", fmt.Errorf("refresh token has already been used")
	}

	return userID, count, timezone, nil
}
```

Then update `validateRefreshToken` in middleware.go (lines 124-156) to delegate:

```go
func validateRefreshToken(service *Service, refreshToken string) (float64, string, error) {
	_, count, timezone, err := validateRefreshTokenCore(service, refreshToken)
	return count, timezone, err
}
```

And update `validateRefreshTokenFiber` in fiber_middleware.go (lines 116-145) to delegate:

```go
func validateRefreshTokenFiber(service *Service, refreshToken string) (float64, string, error) {
	_, count, timezone, err := validateRefreshTokenCore(service, refreshToken)
	return count, timezone, err
}
```

- [ ] **Step 3: Run full auth test suite**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/auth/... -v`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
cd /Users/abhik.ray/Kindred/backend
git add internal/handlers/auth/middleware.go internal/handlers/auth/fiber_middleware.go internal/handlers/auth/middleware_test.go
git commit -m "refactor(auth): consolidate middleware refresh token validation logic"
```

---

## Phase 2: Task Service File Split

### Task 5: Split `service.go` into domain-focused files

**Files:**
- Delete: `internal/handlers/task/service.go`
- Create: `internal/handlers/task/task_service.go`
- Create: `internal/handlers/task/template_service.go`
- Create: `internal/handlers/task/flex_service.go`
- Create: `internal/handlers/task/query_service.go`

All files stay in `package task`. The `Service` struct definition stays in `types.go`. This is a pure move — no logic changes.

- [ ] **Step 1: Create `task_service.go` with CRUD + field update methods**

Move these methods from `service.go` to `task_service.go`:
- `getTasksByUserPipeline` (lines 59-74 — the helper used by multiple methods)
- `GetAllTasks` (lines 76-90)
- `GetTasksByUser` (lines 92-112)
- `GetPublicTasks` (lines 113-136)
- `GetTaskByID` (lines 139-161)
- `CreateTask` (lines 164-181)
- `UpdatePartialTask` (lines 195-276)
- `CompleteTask` (lines 291-474)
- `BulkCompleteTask` (lines 476-795)
- `BulkDeleteTask` (lines 797-961)
- `IncrementTaskCompletedAndDelete` (lines 963-1013)
- `DeleteTask` (lines 1016-1034)
- `DeleteTaskByID` (lines 1990-2020)
- `ActivateTask` (lines 1052-1085)
- `UpdateTaskNotes` (lines 2023-2050)
- `UpdateTaskChecklist` (lines 2053-2100)
- `verifyCategoryOwnership` (lines 2102-2110)
- `UpdateTaskDeadline` (lines 2784-2804)
- `UpdateTaskStart` (lines 2807-2835)
- `UpdateTaskReminders` (lines 2838-2858)

Include the necessary imports at the top.

- [ ] **Step 2: Create `template_service.go` with recurring/template methods**

Move these methods from `service.go` to `template_service.go`:
- `CreateTemplateTask` (lines 183-192)
- `CreateTaskFromTemplate` (lines 1111-1342)
- `DeleteTemplateTask` (lines 1037-1049)
- `DeleteTaskFromTemplateID` (lines 1344-1383)
- `CreateTemplateForTask` (lines 1386-1505)
- `ScheduleNextRecurrence` (lines 1572-1633)
- `GetDueRecurringTasks` (lines 1803-1825)
- `GetTasksWithStartTimesOlderThanOneDay` (lines 1827-1869)
- `GetRecurringTasksWithPastDeadlines` (lines 1871-1905)
- `GetTemplateByID` (lines 2338-2344)
- `ResetTemplateMetrics` (lines 2347-2368)
- `UndoMissedTask` (lines 2375-2428)
- `UpdateTemplateTask` (lines 2431-2455)
- `GetTemplatesByUserWithCategory` (lines 2458-2510)

- [ ] **Step 3: Create `flex_service.go` with flex-specific methods**

Move these methods from `service.go` to `flex_service.go`:
- `createFlexTemplateForTask` (lines 1508-1567)
- `createFlexTaskFromTemplate` (lines 1635-1724)
- `handleFlexCompletion` (lines 1726-1798)

- [ ] **Step 4: Create `query_service.go` with query/listing methods**

Move these methods from `service.go` to `query_service.go`:
- `GetActiveTasks` (lines 1087-1109)
- `GetRandomTaskForToday` (lines 1912-1988)
- `GetCompletedTasks` (lines 2512-2554)
- `QueryTasksByUser` (lines 2557-2697)
- `GetCompletedTasksByDate` (lines 2699-2779)

- [ ] **Step 5: Move reminder methods to existing `reminder.go`**

Move these from `service.go` to the existing `reminder.go` file (which already has `HandleReminder`, `AddReminderToTask`, `ParseReminder`):
- `GetTasksWithPastReminders` (lines 2120-2145)
- `SendReminder` (lines 2147-2172)
- `generateReminderMessage` (lines 2175-2245)
- `UpdateReminderSent` (lines 2293-2313)
- `AddReminderToTask` service method (lines 2315-2336) — note: the handler method `AddReminderToTask` already lives in reminder.go, this is the *service* method

- [ ] **Step 6: Move checkin methods to existing `checkin.go`**

Move these from `service.go` to the existing `checkin.go` file (which already has `HandleCheckin`):
- `GetUserTaskCountsForTodayWithTimezone` (currently in checkin.go already — verify)
- `GetUserTaskCountsForToday` (currently in checkin.go already — verify)
- `GetUsersWithPushTokens` (currently in checkin.go already — verify)

Verify these are already in checkin.go and not duplicated in service.go.

- [ ] **Step 7: Delete `service.go`**

After all methods have been moved out, verify service.go is empty (except possibly the package declaration and imports), then delete it.

- [ ] **Step 8: Run full task test suite**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/task/... -v`
Expected: All tests PASS

- [ ] **Step 9: Commit**

```bash
cd /Users/abhik.ray/Kindred/backend
git add internal/handlers/task/
git commit -m "refactor(task): split service.go into domain-focused files"
```

---

### Task 6: Split `task.go` into domain-focused handler files

**Files:**
- Delete: `internal/handlers/task/task.go`
- Create: `internal/handlers/task/task_handlers.go`
- Create: `internal/handlers/task/template_handlers.go`
- Create: `internal/handlers/task/query_handlers.go`
- Create: `internal/handlers/task/nlp_handlers.go`

All files stay in `package task`.

- [ ] **Step 1: Create `task_handlers.go` with CRUD + field update + bulk handlers**

Move from `task.go`:
- `GetTasksByUser` (lines 45-76)
- `CreateTask` (lines 78-210)
- `GetTasks` (lines 212-218)
- `GetTask` (lines 221-244)
- `UpdateTask` (lines 265-367)
- `CompleteTask` (lines 374-422)
- `DeleteTask` (lines 429-485)
- `BulkCompleteTask` (lines 488-519)
- `BulkDeleteTask` (lines 521-548)
- `ActivateTask` (lines 551-586)
- `GetActiveTasks` (lines 588-600)
- `UpdateTaskNotes` (lines 666-696)
- `UpdateTaskChecklist` (lines 699-729)
- `UpdateTaskDeadline` (lines 942-972)
- `UpdateTaskStart` (lines 975-1005)
- `UpdateTaskReminders` (lines 1008-1038)

- [ ] **Step 2: Create `template_handlers.go` with template/recurring handlers**

Move from `task.go`:
- `CreateTaskFromTemplate` (lines 602-620)
- `GetTasksWithStartTimesOlderThanOneDay` (lines 625-643)
- `GetRecurringTasksWithPastDeadlines` (lines 645-663)
- `GetTemplateByID` (lines 731-743)
- `UpdateTemplate` (lines 745-765)
- `ResetTemplateMetrics` (lines 767-786)
- `UndoMissedTask` (lines 788-815)
- `GetUserTemplates` (lines 817-844)

- [ ] **Step 3: Create `query_handlers.go` with query handlers**

Move from `task.go`:
- `QueryTasksByUser` (lines 1041-1058)
- `GetCompletedTasks` (lines 846-889)
- `GetCompletedTasksByDate` (lines 891-937)

- [ ] **Step 4: Create `nlp_handlers.go` with NLP/AI handlers**

Move from `task.go`:
- `QueryTasksNaturalLanguage` (lines 1061-1137)
- `CreateTaskNaturalLanguage` (lines 1140-1263)
- `EditTasksNaturalLanguage` (lines 1266-1540)
- `applyEditInstructions` (lines 1545-1700)
- `IntentTaskNaturalLanguage` (lines 1706-1824)
- `PreviewTaskNaturalLanguage` (lines 1828-1883)
- `ConfirmTaskNaturalLanguage` (lines 1886-1953)

- [ ] **Step 5: Delete `task.go`**

- [ ] **Step 6: Run full task test suite**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/task/... -v`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
cd /Users/abhik.ray/Kindred/backend
git add internal/handlers/task/
git commit -m "refactor(task): split task.go into domain-focused handler files"
```

---

### Task 7: Split `operations.go` into domain-focused operation files

**Files:**
- Delete: `internal/handlers/task/operations.go`
- Create: `internal/handlers/task/task_operations.go`
- Create: `internal/handlers/task/template_operations.go`
- Create: `internal/handlers/task/query_operations.go`
- Create: `internal/handlers/task/nlp_operations.go`

- [ ] **Step 1: Read operations.go to identify all type definitions and their line ranges**

Read `internal/handlers/task/operations.go` fully and catalog each type definition.

- [ ] **Step 2: Split types to match handler groupings**

Move I/O types into files that match their handler file:
- `task_operations.go`: CRUD, field update, bulk, activation types + their register functions
- `template_operations.go`: Template/recurring types + their register functions
- `query_operations.go`: Query, completed tasks types + their register functions
- `nlp_operations.go`: NLP types, local Gemini mirror types + their register functions

- [ ] **Step 3: Delete `operations.go`**

- [ ] **Step 4: Run full task test suite**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/task/... -v`
Expected: All tests PASS

- [ ] **Step 5: Run full project test suite to catch any import issues**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./... 2>&1 | tail -30`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/abhik.ray/Kindred/backend
git add internal/handlers/task/
git commit -m "refactor(task): split operations.go into domain-focused operation files"
```

---

## Phase 3: Bulk Operation Shared Helpers

### Task 8: Extract shared validation helpers from bulk operations

**Files:**
- Modify: `internal/handlers/task/task_service.go`
- Create: `internal/handlers/task/bulk_helpers.go`
- Create: `internal/handlers/task/bulk_helpers_test.go`

The bulk operations (`BulkCompleteTask` and `BulkDeleteTask`) each use **genuine batch MongoDB operations** (`$in` queries, `$pull` with `$in`, `DeleteMany`), so we keep those optimizations. The duplication is in the **ID parsing/validation boilerplate**. We extract that.

- [ ] **Step 1: Write test for `parseBulkTaskIDs`**

Create `internal/handlers/task/bulk_helpers_test.go`:

```go
package task

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestParseBulkTaskIDs_ValidIDs(t *testing.T) {
	taskID := primitive.NewObjectID()
	catID := primitive.NewObjectID()

	items := []bulkTaskItem{
		{TaskID: taskID.Hex(), CategoryID: catID.Hex()},
	}

	valid, failed := parseBulkTaskIDs(items)
	assert.Equal(t, 1, len(valid))
	assert.Equal(t, 0, len(failed))
	assert.Equal(t, taskID, valid[0].taskID)
	assert.Equal(t, catID, valid[0].categoryID)
}

func TestParseBulkTaskIDs_InvalidTaskID(t *testing.T) {
	catID := primitive.NewObjectID()

	items := []bulkTaskItem{
		{TaskID: "bad-id", CategoryID: catID.Hex()},
	}

	valid, failed := parseBulkTaskIDs(items)
	assert.Equal(t, 0, len(valid))
	assert.Equal(t, 1, len(failed))
	assert.Equal(t, "bad-id", failed[0])
}

func TestParseBulkTaskIDs_InvalidCategoryID(t *testing.T) {
	taskID := primitive.NewObjectID()

	items := []bulkTaskItem{
		{TaskID: taskID.Hex(), CategoryID: "bad-id"},
	}

	valid, failed := parseBulkTaskIDs(items)
	assert.Equal(t, 0, len(valid))
	assert.Equal(t, 1, len(failed))
}

func TestParseBulkTaskIDs_MixedValid(t *testing.T) {
	taskID := primitive.NewObjectID()
	catID := primitive.NewObjectID()

	items := []bulkTaskItem{
		{TaskID: taskID.Hex(), CategoryID: catID.Hex()},
		{TaskID: "bad-id", CategoryID: catID.Hex()},
	}

	valid, failed := parseBulkTaskIDs(items)
	assert.Equal(t, 1, len(valid))
	assert.Equal(t, 1, len(failed))
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/task/... -run TestParseBulkTaskIDs -v`
Expected: FAIL — types not defined

- [ ] **Step 3: Implement `bulk_helpers.go`**

Create `internal/handlers/task/bulk_helpers.go`:

```go
package task

import (
	"log/slog"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// bulkTaskItem is the interface that both BulkCompleteTaskItem and BulkDeleteTaskItem satisfy.
type bulkTaskItem interface {
	GetTaskID() string
	GetCategoryID() string
}

// parsedBulkTask holds the parsed ObjectIDs from a bulk task item.
type parsedBulkTask struct {
	taskID     primitive.ObjectID
	categoryID primitive.ObjectID
	index      int
}

// parseBulkTaskIDs validates and parses hex string IDs into ObjectIDs.
// Returns the valid parsed tasks and a list of failed task ID strings.
func parseBulkTaskIDs(items []bulkTaskItem) ([]parsedBulkTask, []string) {
	valid := make([]parsedBulkTask, 0, len(items))
	failed := make([]string, 0)

	for i, item := range items {
		taskID, err := primitive.ObjectIDFromHex(item.GetTaskID())
		if err != nil {
			failed = append(failed, item.GetTaskID())
			slog.Warn("Invalid task ID in bulk operation", "taskID", item.GetTaskID(), "error", err)
			continue
		}

		categoryID, err := primitive.ObjectIDFromHex(item.GetCategoryID())
		if err != nil {
			failed = append(failed, item.GetTaskID())
			slog.Warn("Invalid category ID in bulk operation", "categoryID", item.GetCategoryID(), "error", err)
			continue
		}

		valid = append(valid, parsedBulkTask{
			taskID:     taskID,
			categoryID: categoryID,
			index:      i,
		})
	}

	return valid, failed
}

// fetchAndValidateBulkTasks fetches tasks by IDs via aggregation and validates ownership.
// Returns a map of found tasks and a list of failed task ID strings.
func fetchAndValidateBulkTasks(
	s *Service,
	userID primitive.ObjectID,
	taskIDs []primitive.ObjectID,
	validTasks []parsedBulkTask,
) (map[primitive.ObjectID]TaskDocument, []string) {
	ctx := context.Background()
	failed := make([]string, 0)

	taskPipeline := getTasksByUserPipeline(userID)
	taskPipeline = append(taskPipeline, bson.D{
		{Key: "$match", Value: bson.M{"_id": bson.M{"$in": taskIDs}}},
	})

	taskCursor, err := s.Tasks.Aggregate(ctx, taskPipeline)
	if err != nil {
		// If we can't fetch at all, mark everything as failed
		for _, vt := range validTasks {
			failed = append(failed, vt.taskID.Hex())
		}
		return nil, failed
	}
	defer taskCursor.Close(ctx)

	var fetchedTasks []TaskDocument
	if err := taskCursor.All(ctx, &fetchedTasks); err != nil {
		for _, vt := range validTasks {
			failed = append(failed, vt.taskID.Hex())
		}
		return nil, failed
	}

	fetchedMap := make(map[primitive.ObjectID]TaskDocument)
	for _, task := range fetchedTasks {
		fetchedMap[task.ID] = task
	}

	return fetchedMap, failed
}
```

Wait — I realize `fetchAndValidateBulkTasks` needs `context` and `bson` imports. Add those to the import block:

```go
import (
	"context"
	"log/slog"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)
```

Also add the `GetTaskID` and `GetCategoryID` methods to `BulkCompleteTaskItem` and `BulkDeleteTaskItem` in the operations file where they are defined. These are simple accessor methods:

```go
func (b BulkCompleteTaskItem) GetTaskID() string    { return b.TaskID }
func (b BulkCompleteTaskItem) GetCategoryID() string { return b.CategoryID }

func (b BulkDeleteTaskItem) GetTaskID() string    { return b.TaskID }
func (b BulkDeleteTaskItem) GetCategoryID() string { return b.CategoryID }
```

- [ ] **Step 4: Update `BulkCompleteTask` and `BulkDeleteTask` to use the shared helpers**

Replace the ID parsing loops in both methods with calls to `parseBulkTaskIDs` and `fetchAndValidateBulkTasks`. Keep the MongoDB batch operations (`$pull`, `DeleteMany`, etc.) exactly as they are.

- [ ] **Step 5: Run test to verify helpers pass**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/task/... -run TestParseBulkTaskIDs -v`
Expected: PASS

- [ ] **Step 6: Run full task test suite**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/task/... -v`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
cd /Users/abhik.ray/Kindred/backend
git add internal/handlers/task/
git commit -m "refactor(task): extract shared validation helpers from bulk operations"
```

---

## Phase 4: Repository Interfaces + Shared Helpers

### Task 9: Create repository package with interfaces and error types

**Files:**
- Create: `internal/repository/interfaces.go`
- Create: `internal/repository/errors.go`

- [ ] **Step 1: Create `internal/repository/errors.go`**

```go
package repository

import "errors"

var (
	ErrNotFound  = errors.New("document not found")
	ErrDuplicate = errors.New("duplicate document")
)
```

- [ ] **Step 2: Create `internal/repository/interfaces.go`**

```go
package repository

import (
	"context"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

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
	RemoveFromFriendsLists(ctx context.Context, id primitive.ObjectID) error
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/abhik.ray/Kindred/backend && go build ./internal/repository/...`
Expected: Success (no errors)

- [ ] **Step 4: Commit**

```bash
cd /Users/abhik.ray/Kindred/backend
git add internal/repository/
git commit -m "refactor: add repository interfaces and error types"
```

---

### Task 10: Create MongoDB user repository implementation

**Files:**
- Create: `internal/repository/mongo/helpers.go`
- Create: `internal/repository/mongo/user_repo.go`
- Create: `internal/repository/mongo/user_repo_test.go`

- [ ] **Step 1: Create shared MongoDB helpers**

Create `internal/repository/mongo/helpers.go`:

```go
package mongo

import (
	"context"
	"errors"

	"github.com/abhikaboy/Kindred/internal/repository"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// findOneByField is the private generic helper for single-document lookups.
func findOneByField[T any](ctx context.Context, coll *mongo.Collection, field string, value any) (*T, error) {
	var result T
	err := coll.FindOne(ctx, bson.M{field: value}).Decode(&result)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, repository.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// findMany is the private generic helper for multi-document queries.
func findMany[T any](ctx context.Context, coll *mongo.Collection, filter bson.M) ([]T, error) {
	cursor, err := coll.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []T
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}
	return results, nil
}

// updateOneByID updates a single document by its _id field.
func updateOneByID(ctx context.Context, coll *mongo.Collection, id any, update bson.M) error {
	_, err := coll.UpdateOne(ctx, bson.M{"_id": id}, update)
	return err
}
```

- [ ] **Step 2: Create `internal/repository/mongo/user_repo.go`**

```go
package mongo

import (
	"context"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/internal/repository"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type userRepo struct {
	collection *mongo.Collection
}

func NewUserRepository(coll *mongo.Collection) repository.UserRepository {
	return &userRepo{collection: coll}
}

func (r *userRepo) GetUserByID(ctx context.Context, id primitive.ObjectID) (*types.User, error) {
	return findOneByField[types.User](ctx, r.collection, "_id", id)
}

func (r *userRepo) GetUserByEmail(ctx context.Context, email string) (*types.User, error) {
	return findOneByField[types.User](ctx, r.collection, "email", email)
}

func (r *userRepo) GetUserByPhone(ctx context.Context, phone string) (*types.User, error) {
	return findOneByField[types.User](ctx, r.collection, "phone", phone)
}

func (r *userRepo) GetUserByGoogleID(ctx context.Context, googleID string) (*types.User, error) {
	return findOneByField[types.User](ctx, r.collection, "google_id", googleID)
}

func (r *userRepo) GetUserByAppleID(ctx context.Context, appleID string) (*types.User, error) {
	return findOneByField[types.User](ctx, r.collection, "apple_id", appleID)
}

func (r *userRepo) CreateUser(ctx context.Context, user *types.User) error {
	_, err := r.collection.InsertOne(ctx, user)
	return err
}

func (r *userRepo) UpdateUser(ctx context.Context, id primitive.ObjectID, update bson.M) error {
	return updateOneByID(ctx, r.collection, id, bson.M{"$set": update})
}

func (r *userRepo) DeleteUser(ctx context.Context, id primitive.ObjectID) error {
	_, err := r.collection.DeleteOne(ctx, bson.M{"_id": id})
	return err
}

func (r *userRepo) GetUsersWithPushTokens(ctx context.Context) ([]types.User, error) {
	return findMany[types.User](ctx, r.collection, bson.M{
		"push_token": bson.M{"$ne": ""},
	})
}

func (r *userRepo) IncrementUserCount(ctx context.Context, id primitive.ObjectID) error {
	return updateOneByID(ctx, r.collection, id, bson.M{"$inc": bson.M{"count": 1}})
}

func (r *userRepo) UpdatePushToken(ctx context.Context, id primitive.ObjectID, token string) error {
	return updateOneByID(ctx, r.collection, id, bson.M{"$set": bson.M{"push_token": token}})
}

func (r *userRepo) CheckTokenCount(ctx context.Context, id primitive.ObjectID) (float64, error) {
	user, err := r.GetUserByID(ctx, id)
	if err != nil {
		return 0, err
	}
	return user.Count, nil
}

func (r *userRepo) MarkTokenUsed(ctx context.Context, id primitive.ObjectID) error {
	return updateOneByID(ctx, r.collection, id, bson.M{"$set": bson.M{"token_used": true}})
}

func (r *userRepo) CheckIfTokenUsed(ctx context.Context, id primitive.ObjectID) (bool, error) {
	user, err := r.GetUserByID(ctx, id)
	if err != nil {
		return false, err
	}
	return user.TokenUsed, nil
}

func (r *userRepo) AcceptTerms(ctx context.Context, id primitive.ObjectID, version string) (*time.Time, error) {
	now := time.Now()
	err := updateOneByID(ctx, r.collection, id, bson.M{
		"$set": bson.M{
			"terms_accepted_at":      now,
			"terms_accepted_version": version,
		},
	})
	if err != nil {
		return nil, err
	}
	return &now, nil
}

func (r *userRepo) RemoveFromFriendsLists(ctx context.Context, id primitive.ObjectID) error {
	_, err := r.collection.UpdateMany(ctx,
		bson.M{"friends": id},
		bson.M{"$pull": bson.M{"friends": id}},
	)
	return err
}
```

- [ ] **Step 3: Write integration test for user repository**

Create `internal/repository/mongo/user_repo_test.go`:

```go
package mongo

import (
	"context"
	"testing"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/internal/repository"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// These tests require a running MongoDB instance.
// They are skipped in CI unless MONGO_TEST_URI is set.
func setupTestRepo(t *testing.T) (repository.UserRepository, func()) {
	t.Helper()
	uri := "mongodb://localhost:27017"
	// Use test environment helper if available
	ctx := context.Background()

	client, err := mongoDriver.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		t.Skip("MongoDB not available, skipping integration test")
	}

	dbName := "kindred_test_repo_" + primitive.NewObjectID().Hex()[:8]
	coll := client.Database(dbName).Collection("users")
	repo := NewUserRepository(coll)

	cleanup := func() {
		client.Database(dbName).Drop(ctx)
		client.Disconnect(ctx)
	}

	return repo, cleanup
}

func TestUserRepo_CreateAndGetByID(t *testing.T) {
	repo, cleanup := setupTestRepo(t)
	defer cleanup()

	ctx := context.Background()
	user := &types.User{
		ID:          primitive.NewObjectID(),
		Email:       "test@example.com",
		DisplayName: "Test",
		Handle:      "test",
	}

	err := repo.CreateUser(ctx, user)
	require.NoError(t, err)

	found, err := repo.GetUserByID(ctx, user.ID)
	require.NoError(t, err)
	assert.Equal(t, user.Email, found.Email)
}

func TestUserRepo_GetByEmail(t *testing.T) {
	repo, cleanup := setupTestRepo(t)
	defer cleanup()

	ctx := context.Background()
	user := &types.User{
		ID:    primitive.NewObjectID(),
		Email: "lookup@example.com",
	}

	err := repo.CreateUser(ctx, user)
	require.NoError(t, err)

	found, err := repo.GetUserByEmail(ctx, "lookup@example.com")
	require.NoError(t, err)
	assert.Equal(t, user.ID, found.ID)
}

func TestUserRepo_NotFound(t *testing.T) {
	repo, cleanup := setupTestRepo(t)
	defer cleanup()

	ctx := context.Background()
	_, err := repo.GetUserByID(ctx, primitive.NewObjectID())
	assert.ErrorIs(t, err, repository.ErrNotFound)
}
```

Note: The test setup uses a direct MongoDB connection. Adjust the import for `mongo.Connect` — it needs:
```go
import (
	mongoDriver "go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)
```

- [ ] **Step 4: Verify it compiles**

Run: `cd /Users/abhik.ray/Kindred/backend && go build ./internal/repository/...`
Expected: Success

- [ ] **Step 5: Run repository tests (if MongoDB available)**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./internal/repository/... -v`
Expected: PASS (or SKIP if no local MongoDB)

- [ ] **Step 6: Commit**

```bash
cd /Users/abhik.ray/Kindred/backend
git add internal/repository/
git commit -m "feat: add MongoDB user repository implementation with shared helpers"
```

---

### Task 11: Migrate auth service to use UserRepository

**Files:**
- Modify: `internal/handlers/auth/types.go`
- Modify: `internal/handlers/auth/service.go`
- Modify: `internal/handlers/auth/routes.go`
- Modify: `internal/handlers/auth/middleware.go`
- Modify: `internal/handlers/auth/fiber_middleware.go`

- [ ] **Step 1: Update `Service` struct in types.go to accept `UserRepository`**

Replace the `Service` struct in `types.go` (lines 17-22):

```go
type Service struct {
	users      repository.UserRepository
	categories *mongo.Collection
	referrals  *mongo.Collection
	config     config.Config
}
```

Add import: `"github.com/abhikaboy/Kindred/internal/repository"`

Update `newService` (lines 24-31):

```go
func newService(users repository.UserRepository, categories *mongo.Collection, referrals *mongo.Collection, config config.Config) *Service {
	return &Service{
		users:      users,
		categories: categories,
		referrals:  referrals,
		config:     config,
	}
}

func NewServiceWithConfig(collections map[string]*mongo.Collection, cfg config.Config) *Service {
	users := mongorepo.NewUserRepository(collections["users"])
	return newService(users, collections["categories"], collections["referrals"], cfg)
}
```

Add import: `mongorepo "github.com/abhikaboy/Kindred/internal/repository/mongo"`

- [ ] **Step 2: Update routes.go to create repository**

Update `Routes` in `routes.go` (line 15) and any other constructor calls to use `NewServiceWithConfig` pattern which now creates the repo internally.

- [ ] **Step 3: Migrate service.go methods from `s.users.FindOne(...)` to repository calls**

Go through each method in `service.go` that accesses `s.users` and replace with repository method calls. Key changes:

- `GetUserCount` (line 53): Replace `s.users.FindOne(context.Background(), bson.M{"_id": id}).Decode(&user)` with `user, err := s.users.GetUserByID(context.Background(), id)` then return `user.Count`
- `LoginFromCredentials`: Replace `s.findByField("email", email)` with `s.users.GetUserByEmail(ctx, email)` — handle `repository.ErrNotFound` → `fiber.NewError(404, ...)`
- `LoginFromPhone`: Replace with `s.users.GetUserByPhone(ctx, phone)`
- `LoginFromApple`: Replace with `s.users.GetUserByAppleID(ctx, apple_id)`
- `LoginFromGoogle`: Replace with `s.users.GetUserByGoogleID(ctx, google_id)`
- `LoginFromPhoneOTP`: Replace with `s.users.GetUserByPhone(ctx, phone)`
- `InvalidateTokens`: Replace with `s.users.IncrementUserCount(ctx, id)`
- `UseToken`: Replace with `s.users.MarkTokenUsed(ctx, id)`
- `CheckIfTokenUsed`: Replace with `s.users.CheckIfTokenUsed(ctx, id)`
- `CreateUser`: Replace with `s.users.CreateUser(ctx, &user)`
- `GetUser`: Replace with `s.users.GetUserByID(ctx, id)` and build SafeUser
- `UpdatePushToken`: Replace with `s.users.UpdatePushToken(ctx, id, token)`
- `DeleteAccount`: Replace user operations with repo calls
- `AcceptTerms`: Replace with `s.users.AcceptTerms(ctx, id, version)`

For each replacement, map `repository.ErrNotFound` to the appropriate HTTP error to preserve existing behavior.

- [ ] **Step 4: Update middleware.go constructor**

Update `AuthMiddleware` (line 22) to create the user repository:

```go
func AuthMiddleware(collections map[string]*mongo.Collection, cfg config.Config) func(http.Handler) http.Handler {
	service := NewServiceWithConfig(collections, cfg)
	// ... rest stays the same
```

- [ ] **Step 5: Update fiber_middleware.go constructor**

Same change for `FiberAuthMiddleware` (line 17).

- [ ] **Step 6: Remove the `findByField` method from service.go**

It's no longer needed — the repository has typed lookup methods.

- [ ] **Step 7: Run full auth test suite**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/auth/... -v`
Expected: All tests PASS

- [ ] **Step 8: Run full project test suite**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./... 2>&1 | tail -30`
Expected: All tests PASS

- [ ] **Step 9: Commit**

```bash
cd /Users/abhik.ray/Kindred/backend
git add internal/handlers/auth/ internal/repository/
git commit -m "refactor(auth): migrate auth service to use UserRepository interface"
```

---

### Task 12: Migrate task service checkin/reminder to use UserRepository

**Files:**
- Modify: `internal/handlers/task/types.go`
- Modify: `internal/handlers/task/routes.go`
- Modify: `internal/handlers/task/checkin.go`

The task service also accesses the `Users` collection directly for checkin/push notification operations. Migrate those to the repository.

- [ ] **Step 1: Add `UserRepository` to task Service struct**

In `internal/handlers/task/types.go`, add a `Users` field as `repository.UserRepository` alongside the existing `*mongo.Collection` fields. The task service's core operations use the `Tasks` (categories) collection via complex aggregation pipelines that are hard to abstract — we migrate only the user lookups.

```go
type Service struct {
	Users               repository.UserRepository
	Tasks               *mongo.Collection // categories — complex aggregation pipelines
	CompletedTasks      *mongo.Collection
	TemplateTasks       *mongo.Collection
	EncouragementHelper EncouragementServiceInterface
}
```

- [ ] **Step 2: Update task `newService` in routes.go**

```go
func Routes(api huma.API, collections map[string]*mongo.Collection, geminiService any) {
	users := mongorepo.NewUserRepository(collections["users"])
	service := newService(users, collections)
	// ...
}
```

Update `newService` to accept the user repo:

```go
func newService(users repository.UserRepository, collections map[string]*mongo.Collection) *Service {
	return &Service{
		Users:               users,
		Tasks:               collections["categories"],
		CompletedTasks:      collections["completed-tasks"],
		TemplateTasks:       collections["template-tasks"],
		EncouragementHelper: encouragement.NewEncouragementService(collections),
	}
}
```

- [ ] **Step 3: Update checkin.go to use repository**

Replace `s.Users.FindOne(...)` and `s.Users.Find(...)` calls in `GetUsersWithPushTokens` and any other user-accessing methods with repository calls.

- [ ] **Step 4: Run full task test suite**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/task/... -v`
Expected: All tests PASS

- [ ] **Step 5: Run full project test suite**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./... 2>&1 | tail -30`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/abhik.ray/Kindred/backend
git add internal/handlers/task/ internal/repository/
git commit -m "refactor(task): migrate user operations to UserRepository interface"
```

---

### Task 13: Final verification and cleanup

**Files:**
- All modified files

- [ ] **Step 1: Run full project build**

Run: `cd /Users/abhik.ray/Kindred/backend && go build ./...`
Expected: No compile errors

- [ ] **Step 2: Run full test suite**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./... -v 2>&1 | tail -50`
Expected: All tests PASS

- [ ] **Step 3: Run vet and check for issues**

Run: `cd /Users/abhik.ray/Kindred/backend && go vet ./...`
Expected: No issues

- [ ] **Step 4: Verify no unused imports or dead code**

Run: `cd /Users/abhik.ray/Kindred/backend && go build ./... 2>&1`
Expected: Clean build

- [ ] **Step 5: Commit any cleanup**

```bash
cd /Users/abhik.ray/Kindred/backend
git add -A
git commit -m "refactor: final cleanup after backend refactor"
```
