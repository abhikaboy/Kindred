# Task Tagging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users can tag friends in their tasks; the tagged friend gets a push + a home-screen banner with Watch / Copy / Untag actions, watchers get pinged on every completion, and the tag relationship survives recurrence.

**Architecture:** Tags are a denormalized `taggedUsers` array embedded on `TaskDocument` (and mirrored on `TemplateTaskDocument` so recurrence carries them), following the existing `encouragements` pattern. Tasks live embedded in the `categories` collection — all writes use the `tasks.$[t]` array-filter pattern. Three new endpoints: update tags on a task, list pending tags for the signed-in user, respond to a tag. Pushes go through `xutils.SendNotification`; DB notification records through `notifications.Service`.

**Tech Stack:** Go backend (Huma v2 + Fiber, MongoDB driver, testify suites), React Native/Expo frontend (expo-router, @tanstack/react-query, @gorhom/bottom-sheet, phosphor-react-native).

**Spec:** `docs/superpowers/specs/2026-06-10-task-tagging-design.md`

**One deliberate deviation from the spec:** the spec says the create-flow tag field "opens the existing `tag-people.tsx` screen". That screen is an expo-router route; navigating to it from inside the create bottom-sheet would dismiss the sheet. Instead we extract the picker UI from `tag-people.tsx` into a shared `FriendPicker` component and render it as an in-modal screen (`Screen.COLLABORATORS`), exactly how Deadline/Reminder screens work. Same UX, same code reuse, no sheet dismissal.

**Conventions for all tasks:**
- Backend tests: `cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/task/... -run <TestName> -v`. Test suites use `testpkg.BaseSuite` (see `internal/handlers/task/service_test.go` for the pattern — `s.GetUser(0)` returns fixture users).
- Frontend verification: `cd /Users/abhik.ray/Kindred/frontend && bun x tsc --noEmit` (always `bun`, never `npx`).
- The frontend `handle` field already includes the `@` — never prepend another.
- Commit after every task. Pre-commit hooks run gofmt/go vet automatically.

---

## Backend

### Task 1: Model groundwork — TaggedTaskUser type, document fields, notification constants

**Files:**
- Modify: `backend/internal/handlers/types/types.go` (TaskDocument ~line 46-91, TemplateTaskDocument ~line 130-167)
- Modify: `backend/internal/handlers/task/types.go` (CreateTaskParams ~line 21, type aliases ~line 48)
- Modify: `backend/internal/handlers/notifications/types.go` (NotificationType consts ~line 24-33)

- [ ] **Step 1: Add the TaggedTaskUser struct and status constants**

In `backend/internal/handlers/types/types.go`, directly below the `TaskKudos` struct (~line 110), add:

```go
// Tag status lifecycle: pending -> watching | copied | untagged.
const (
	TagStatusPending  = "pending"
	TagStatusWatching = "watching"
	TagStatusCopied   = "copied"
	TagStatusUntagged = "untagged"
)

// TaggedTaskUser is one friend tagged on a task, denormalized at tag time so
// the client can render the watcher row without a join.
type TaggedTaskUser struct {
	ID             primitive.ObjectID `bson:"id" json:"id"`
	Handle         string             `bson:"handle" json:"handle"`
	DisplayName    string             `bson:"display_name" json:"display_name"`
	ProfilePicture string             `bson:"profile_picture" json:"profile_picture"`
	Status         string             `bson:"status" json:"status"` // pending | watching | copied | untagged
}
```

- [ ] **Step 2: Add the field to both document structs**

In `TaskDocument` (same file), after the `Encouragements` field (~line 90), add:

```go
	// Friends tagged on this task (denormalized at tag time).
	TaggedUsers []TaggedTaskUser `bson:"taggedUsers,omitempty" json:"taggedUsers,omitempty"`
```

In `TemplateTaskDocument` (same file), after the `FlexState` field (~line 166), add:

```go
	// Mirrored from the live task so generated instances inherit tag state.
	TaggedUsers []TaggedTaskUser `bson:"taggedUsers,omitempty" json:"taggedUsers,omitempty"`
```

- [ ] **Step 3: Add the create param and type alias**

In `backend/internal/handlers/task/types.go`, add to `CreateTaskParams` after the `Integration` field:

```go
	TaggedUserIDs []string `bson:"-" json:"taggedUserIds,omitempty"`
```

(`bson:"-"` — the handler resolves IDs to denormalized entries; raw IDs are never stored.)

In the type-alias block (~line 48, next to `type TaskDocument = types.TaskDocument`), add:

```go
type TaggedTaskUser = types.TaggedTaskUser
```

- [ ] **Step 4: Add notification type constants**

In `backend/internal/handlers/notifications/types.go`, add to the const block:

```go
	NotificationTypeTaskTagged NotificationType = "TASK_TAGGED"
	NotificationTypeTaskCopied NotificationType = "TASK_COPIED"
```

- [ ] **Step 5: Verify it compiles**

Run: `cd /Users/abhik.ray/Kindred/backend && go build ./...`
Expected: clean build, no output.

- [ ] **Step 6: Commit**

```bash
git add backend/internal/handlers/types/types.go backend/internal/handlers/task/types.go backend/internal/handlers/notifications/types.go
git commit -m "feat(tags): TaggedTaskUser model, document fields, notification types"
```

---

### Task 2: Tag resolution + persistence on task create

**Files:**
- Create: `backend/internal/handlers/task/tag_service.go`
- Modify: `backend/internal/handlers/task/task_handlers.go` (CreateTask, ~line 111 task doc construction and ~line 190 CreateTemplateForTask call)
- Modify: `backend/internal/handlers/task/template_service.go` (CreateTemplateForTask signature, ~line 18 InsertOne)
- Test: `backend/internal/handlers/task/tag_service_test.go`

- [ ] **Step 1: Write the failing tests**

Create `backend/internal/handlers/task/tag_service_test.go`. Mirror the suite setup in `service_test.go`:

```go
package task

import (
	"testing"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"github.com/stretchr/testify/suite"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type TagServiceTestSuite struct {
	testpkg.BaseSuite
	service *Service
}

func (s *TagServiceTestSuite) SetupTest() {
	s.BaseSuite.SetupTest()
	s.service = NewService(s.Collections)
}

func TestTagService(t *testing.T) {
	suite.Run(t, new(TagServiceTestSuite))
}

func (s *TagServiceTestSuite) TestBuildTaggedUsers_DenormalizesUserInfo() {
	friend := s.GetUser(1)

	tagged, err := s.service.BuildTaggedUsers([]string{friend.ID.Hex()})

	s.NoError(err)
	s.Len(tagged, 1)
	s.Equal(friend.ID, tagged[0].ID)
	s.Equal(friend.Handle, tagged[0].Handle)
	s.Equal(friend.DisplayName, tagged[0].DisplayName)
	s.Equal(types.TagStatusPending, tagged[0].Status)
}

func (s *TagServiceTestSuite) TestBuildTaggedUsers_SkipsInvalidAndUnknownIDs() {
	tagged, err := s.service.BuildTaggedUsers([]string{"not-an-objectid", primitive.NewObjectID().Hex()})

	s.NoError(err)
	s.Len(tagged, 0)
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/task/... -run TestTagService -v`
Expected: compile error — `s.service.BuildTaggedUsers undefined`.

- [ ] **Step 3: Implement BuildTaggedUsers**

Create `backend/internal/handlers/task/tag_service.go`:

```go
package task

import (
	"context"
	"log/slog"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// BuildTaggedUsers resolves raw user IDs to denormalized pending tag entries.
// Invalid or unknown IDs are skipped rather than failing the whole create.
func (s *Service) BuildTaggedUsers(userIDs []string) ([]types.TaggedTaskUser, error) {
	ctx := context.Background()
	tagged := make([]types.TaggedTaskUser, 0, len(userIDs))
	seen := make(map[primitive.ObjectID]bool)

	for _, raw := range userIDs {
		id, err := primitive.ObjectIDFromHex(raw)
		if err != nil {
			slog.Warn("Skipping invalid tagged user ID", "id", raw)
			continue
		}
		if seen[id] {
			continue
		}
		user, err := s.Users.GetUserByID(ctx, id)
		if err != nil || user == nil {
			slog.Warn("Skipping unknown tagged user", "id", raw)
			continue
		}
		seen[id] = true
		tagged = append(tagged, types.TaggedTaskUser{
			ID:             user.ID,
			Handle:         user.Handle,
			DisplayName:    user.DisplayName,
			ProfilePicture: user.ProfilePicture,
			Status:         types.TagStatusPending,
		})
	}
	return tagged, nil
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/task/... -run TestTagService -v`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire into CreateTask handler**

In `backend/internal/handlers/task/task_handlers.go`, in `CreateTask`, after the `task := TaskDocument{...}` construction (~line 132) and before the recurring-template block, add:

```go
	// Resolve tagged friends to denormalized pending entries
	if len(taskParams.TaggedUserIDs) > 0 {
		tagged, err := h.service.BuildTaggedUsers(taskParams.TaggedUserIDs)
		if err != nil {
			slog.Error("Failed to resolve tagged users", "error", err)
		} else {
			task.TaggedUsers = tagged
		}
	}
```

- [ ] **Step 6: Carry tags onto the recurring template**

In `backend/internal/handlers/task/template_service.go`, add a `taggedUsers []types.TaggedTaskUser` parameter to `CreateTemplateForTask` (last position) and set it on the template document before `s.TemplateTasks.InsertOne(ctx, r)` (~line 18). Find the struct construction inside that function and add `TaggedUsers: taggedUsers,`. Check the import block includes `"github.com/abhikaboy/Kindred/internal/handlers/types"` (it may already via the alias — the alias `TaggedTaskUser` from `task/types.go` also works; prefer the alias for consistency with the rest of the file).

Update both call sites in `task_handlers.go` (lines ~190 and ~346 — `grep -n "CreateTemplateForTask" task_handlers.go`) to pass `task.TaggedUsers` (create path) and the existing task's `TaggedUsers` or `nil` (update path at ~346: pass `nil` — tagging during edit-to-recurring conversion is out of scope).

- [ ] **Step 7: Write a persistence test**

Add to `tag_service_test.go`:

```go
func (s *TagServiceTestSuite) TestCreateTask_PersistsTaggedUsers() {
	owner := s.GetUser(0)
	friend := s.GetUser(1)

	categoryID := s.GetCategoryID(owner.ID) // see service_test.go for how existing tests obtain a category; mirror that helper/fixture access exactly

	tagged, err := s.service.BuildTaggedUsers([]string{friend.ID.Hex()})
	s.NoError(err)

	task := TaskDocument{
		ID:          primitive.NewObjectID(),
		Content:     "Read 30 mins",
		Priority:    1,
		Value:       2,
		UserID:      owner.ID,
		CategoryID:  categoryID,
		Active:      true,
		TaggedUsers: tagged,
	}
	created, err := s.service.CreateTask(categoryID, &task)
	s.NoError(err)

	fetched, err := s.service.GetTaskByID(created.ID, owner.ID)
	s.NoError(err)
	s.Len(fetched.TaggedUsers, 1)
	s.Equal(types.TagStatusPending, fetched.TaggedUsers[0].Status)
}
```

Note: if `s.GetCategoryID` doesn't exist as written, open `service_test.go` and copy how an existing CreateTask/CompleteTask test obtains a category ID for a fixture user — use that exact mechanism.

- [ ] **Step 8: Run tests, verify pass**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/task/... -run TestTagService -v`
Expected: PASS (3 tests).

- [ ] **Step 9: Commit**

```bash
git add backend/internal/handlers/task/
git commit -m "feat(tags): resolve and persist taggedUsers on task create"
```

---

### Task 3: Tag notifications on create (push + DB record)

**Files:**
- Create: `backend/internal/handlers/task/tag_notifications.go`
- Modify: `backend/internal/handlers/task/task_service.go` (Service struct ~line 60-72 in newService; struct definition — `grep -n "type Service struct" task_service.go` or it may live in `types.go`)
- Modify: `backend/internal/handlers/task/task_handlers.go` (CreateTask, after successful `h.service.CreateTask`)
- Test: extend `backend/internal/handlers/task/tag_service_test.go`

- [ ] **Step 1: Add NotificationService to the task Service**

Find the `Service` struct (`grep -rn "type Service struct" backend/internal/handlers/task/`). Add the field:

```go
	NotificationService *notifications.Service
```

(Check the concrete return type of `notifications.NewNotificationService` in `backend/internal/handlers/notifications/service.go` and use that exact type.)

In `newService` (`task_service.go` ~line 60), add to the constructed struct, mirroring `encouragement/service.go:40`:

```go
		NotificationService: notifications.NewNotificationService(collections),
```

Add the import `"github.com/abhikaboy/Kindred/internal/handlers/notifications"`.

- [ ] **Step 2: Write the failing test**

Existing push-notification tests live in `backend/internal/handlers/encouragement/service_test.go:648` (`TestNotifyEncouragersOfCompletion_Success`). Open that test, see how it stubs `xutils.DefaultPushSender` (there will be a mock sender in the test utilities), and mirror the same stubbing here.

Add to `tag_service_test.go`:

```go
func (s *TagServiceTestSuite) TestNotifyTaggedUsers_CreatesNotificationRecords() {
	owner := s.GetUser(0)
	friend := s.GetUser(1)

	tagged, _ := s.service.BuildTaggedUsers([]string{friend.ID.Hex()})
	task := TaskDocument{ID: primitive.NewObjectID(), Content: "Read 30 mins", UserID: owner.ID, TaggedUsers: tagged}

	s.service.NotifyTaggedUsers(&task, owner.ID)

	// A TASK_TAGGED notification record should exist for the friend
	count, err := s.Collections["notifications"].CountDocuments(
		s.T().Context(),
		map[string]interface{}{"receiver": friend.ID, "notificationType": "TASK_TAGGED"},
	)
	s.NoError(err)
	s.Equal(int64(1), count)
}
```

(Adjust the raw collection access to whatever `BaseSuite` exposes — existing tests in `encouragement/service_test.go` show the idiom for asserting on notification records; copy it.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/task/... -run TestTagService -v`
Expected: compile error — `NotifyTaggedUsers undefined`.

- [ ] **Step 4: Implement NotifyTaggedUsers**

Create `backend/internal/handlers/task/tag_notifications.go`:

```go
package task

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/abhikaboy/Kindred/internal/handlers/notifications"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/xutils"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// NotifyTaggedUsers sends a push + creates a TASK_TAGGED notification record
// for every pending tagged user on the task. Best-effort: failures are logged,
// never returned, so they can't fail task creation.
func (s *Service) NotifyTaggedUsers(task *TaskDocument, taggerID primitive.ObjectID) {
	ctx := context.Background()

	tagger, err := s.Users.GetUserByID(ctx, taggerID)
	if err != nil || tagger == nil {
		slog.Error("NotifyTaggedUsers: failed to load tagger", "error", err)
		return
	}

	for _, tu := range task.TaggedUsers {
		if tu.Status != types.TagStatusPending {
			continue
		}

		// DB record (drives the activity tab)
		content := fmt.Sprintf("tagged you in \"%s\"", task.Content)
		if err := s.NotificationService.CreateNotification(
			taggerID, tu.ID, content, notifications.NotificationTypeTaskTagged, task.ID,
		); err != nil {
			slog.Error("Failed to create TASK_TAGGED record", "receiver", tu.ID, "error", err)
		}

		// Push
		receiver, err := s.Users.GetUserByID(ctx, tu.ID)
		if err != nil || receiver == nil || receiver.PushToken == "" {
			continue
		}
		notification := xutils.Notification{
			Token:   receiver.PushToken,
			Title:   "You've been tagged 👀",
			Message: fmt.Sprintf("%s tagged you in \"%s\"", tagger.DisplayName, task.Content),
			Data: map[string]string{
				"type":      "task_tagged",
				"task_id":   task.ID.Hex(),
				"user_id":   taggerID.Hex(),
				"task_name": task.Content,
			},
		}
		if err := xutils.SendNotification(notification); err != nil {
			slog.Error("Failed to send task_tagged push", "receiver", tu.ID, "error", err)
		}
	}
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/task/... -run TestTagService -v`
Expected: PASS.

- [ ] **Step 6: Call it from the CreateTask handler**

In `task_handlers.go` `CreateTask`, after `doc, err := h.service.CreateTask(categoryID, &task)` succeeds (~line 213), add:

```go
	if len(doc.TaggedUsers) > 0 {
		go h.service.NotifyTaggedUsers(doc, userObjID)
	}
```

- [ ] **Step 7: Build + commit**

Run: `cd /Users/abhik.ray/Kindred/backend && go build ./... && go test ./internal/handlers/task/... -v -run TestTagService`
Expected: PASS.

```bash
git add backend/internal/handlers/task/
git commit -m "feat(tags): push + notification record when friends are tagged"
```

---

### Task 4: Update tags on an existing task — PATCH endpoint

**Files:**
- Modify: `backend/internal/handlers/task/tag_service.go` (add UpdateTaskTags)
- Create: `backend/internal/handlers/task/tag_operations.go` (input/output types + registration + handler)
- Modify: `backend/internal/handlers/task/routes.go` (register)
- Test: extend `backend/internal/handlers/task/tag_service_test.go`

- [ ] **Step 1: Write the failing tests**

```go
func (s *TagServiceTestSuite) TestUpdateTaskTags_AddsAndRemovesPendingOnly() {
	owner := s.GetUser(0)
	friendA := s.GetUser(1)
	friendB := s.GetUser(2)
	categoryID := s.GetCategoryID(owner.ID)

	// Seed: task tagged with A (already watching) — responded entries must survive removal
	tagged, _ := s.service.BuildTaggedUsers([]string{friendA.ID.Hex()})
	tagged[0].Status = types.TagStatusWatching
	task := TaskDocument{ID: primitive.NewObjectID(), Content: "x", Priority: 1, Value: 1,
		UserID: owner.ID, CategoryID: categoryID, Active: true, TaggedUsers: tagged}
	created, err := s.service.CreateTask(categoryID, &task)
	s.NoError(err)

	// Update to only B: A is watching so must remain; B added as pending
	added, err := s.service.UpdateTaskTags(owner.ID, categoryID, created.ID, []string{friendB.ID.Hex()})
	s.NoError(err)
	s.Len(added, 1)
	s.Equal(friendB.ID, added[0].ID)

	fetched, err := s.service.GetTaskByID(created.ID, owner.ID)
	s.NoError(err)
	s.Len(fetched.TaggedUsers, 2)

	byID := map[primitive.ObjectID]string{}
	for _, tu := range fetched.TaggedUsers {
		byID[tu.ID] = tu.Status
	}
	s.Equal(types.TagStatusWatching, byID[friendA.ID])
	s.Equal(types.TagStatusPending, byID[friendB.ID])
}

func (s *TagServiceTestSuite) TestUpdateTaskTags_RemovesPendingEntry() {
	owner := s.GetUser(0)
	friendA := s.GetUser(1)
	categoryID := s.GetCategoryID(owner.ID)

	tagged, _ := s.service.BuildTaggedUsers([]string{friendA.ID.Hex()})
	task := TaskDocument{ID: primitive.NewObjectID(), Content: "x", Priority: 1, Value: 1,
		UserID: owner.ID, CategoryID: categoryID, Active: true, TaggedUsers: tagged}
	created, err := s.service.CreateTask(categoryID, &task)
	s.NoError(err)

	_, err = s.service.UpdateTaskTags(owner.ID, categoryID, created.ID, []string{})
	s.NoError(err)

	fetched, err := s.service.GetTaskByID(created.ID, owner.ID)
	s.NoError(err)
	s.Len(fetched.TaggedUsers, 0)
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/task/... -run TestTagService -v`
Expected: compile error — `UpdateTaskTags undefined`.

- [ ] **Step 3: Implement UpdateTaskTags**

Add to `tag_service.go`:

```go
// UpdateTaskTags reconciles the task's tag list against the desired ID set.
// Entries that already responded (watching/copied/untagged) are never removed
// (spec: removal-after-response is out of scope). Pending entries not in the
// new set are dropped. New IDs are added as pending. Returns the newly added
// entries so the handler can notify them. Mirrors the template when recurring.
func (s *Service) UpdateTaskTags(
	userID, categoryID, taskID primitive.ObjectID,
	taggedUserIDs []string,
) ([]types.TaggedTaskUser, error) {
	ctx := context.Background()

	if err := s.verifyCategoryOwnership(ctx, categoryID, userID); err != nil {
		return nil, err
	}
	task, err := s.findTaskInCategory(ctx, categoryID, taskID)
	if err != nil {
		return nil, err
	}

	desired := make(map[primitive.ObjectID]bool, len(taggedUserIDs))
	for _, raw := range taggedUserIDs {
		if id, err := primitive.ObjectIDFromHex(raw); err == nil {
			desired[id] = true
		}
	}

	next := make([]types.TaggedTaskUser, 0, len(taggedUserIDs))
	existing := make(map[primitive.ObjectID]bool)
	for _, tu := range task.TaggedUsers {
		// Responded entries always survive; pending survives only if still desired
		if tu.Status != types.TagStatusPending || desired[tu.ID] {
			next = append(next, tu)
			existing[tu.ID] = true
		}
	}

	newIDs := make([]string, 0)
	for _, raw := range taggedUserIDs {
		id, err := primitive.ObjectIDFromHex(raw)
		if err != nil || existing[id] {
			continue
		}
		newIDs = append(newIDs, raw)
	}
	added, err := s.BuildTaggedUsers(newIDs)
	if err != nil {
		return nil, err
	}
	next = append(next, added...)

	_, err = s.Tasks.UpdateOne(ctx,
		bson.M{"_id": categoryID, "tasks._id": taskID},
		bson.M{"$set": bson.M{"tasks.$[t].taggedUsers": next}},
		getTaskArrayFilterOptions(taskID),
	)
	if err != nil {
		return nil, err
	}

	if task.TemplateID != nil {
		if _, err := s.TemplateTasks.UpdateOne(ctx,
			bson.M{"_id": *task.TemplateID},
			bson.M{"$set": bson.M{"taggedUsers": next}},
		); err != nil {
			slog.Error("Failed to mirror tags to template", "templateID", task.TemplateID.Hex(), "error", err)
		}
	}

	return added, nil
}
```

Add the missing imports (`go.mongodb.org/mongo-driver/bson`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/task/... -run TestTagService -v`
Expected: PASS.

- [ ] **Step 5: Add the HTTP operation**

Create `backend/internal/handlers/task/tag_operations.go`:

```go
package task

import (
	"context"
	"net/http"

	"github.com/abhikaboy/Kindred/internal/xutils/auth"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// NOTE: check the auth import path used at the top of task_handlers.go and use
// that exact path — it may be "github.com/abhikaboy/Kindred/internal/auth".

type UpdateTaskTagsInput struct {
	Authorization string `header:"Authorization" required:"true"`
	Category      string `path:"category" example:"507f1f77bcf86cd799439011"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
	Body          struct {
		TaggedUserIDs []string `json:"taggedUserIds"`
	} `json:"body"`
}

type UpdateTaskTagsOutput struct {
	Body struct {
		TaggedUsers []types.TaggedTaskUser `json:"taggedUsers"`
	} `json:"body"`
}

func (h *Handler) UpdateTaskTags(ctx context.Context, input *UpdateTaskTagsInput) (*UpdateTaskTagsOutput, error) {
	taskID, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid task ID format", err)
	}
	categoryID, err := primitive.ObjectIDFromHex(input.Category)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid category ID format", err)
	}
	contextID, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Please log in to continue", err)
	}
	userObjID, err := primitive.ObjectIDFromHex(contextID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	added, err := h.service.UpdateTaskTags(userObjID, categoryID, taskID, input.Body.TaggedUserIDs)
	if err != nil {
		return nil, huma.Error500InternalServerError("Unable to update tags", err)
	}

	// Notify newly added friends (best-effort)
	if len(added) > 0 {
		task, err := h.service.findTaskInCategory(ctx, categoryID, taskID)
		if err == nil {
			notifyTask := *task
			notifyTask.TaggedUsers = added
			go h.service.NotifyTaggedUsers(&notifyTask, userObjID)
		}
	}

	task, err := h.service.findTaskInCategory(ctx, categoryID, taskID)
	if err != nil {
		return nil, huma.Error500InternalServerError("Unable to fetch updated task", err)
	}
	resp := &UpdateTaskTagsOutput{}
	resp.Body.TaggedUsers = task.TaggedUsers
	return resp, nil
}

func RegisterUpdateTaskTagsOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "update-task-tags",
		Method:      http.MethodPatch,
		Path:        "/v1/user/tasks/{category}/{id}/tags",
		Summary:     "Update task tags",
		Description: "Replace the set of friends tagged on a task",
		Tags:        []string{"tasks"},
	}, handler.UpdateTaskTags)
}
```

- [ ] **Step 6: Register the route**

In `backend/internal/handlers/task/routes.go`, find `RegisterTaskOperations` and add:

```go
	RegisterUpdateTaskTagsOperation(api, handler)
```

- [ ] **Step 7: Build, test, commit**

Run: `cd /Users/abhik.ray/Kindred/backend && go build ./... && go test ./internal/handlers/task/... -run TestTagService -v`
Expected: PASS.

```bash
git add backend/internal/handlers/task/
git commit -m "feat(tags): PATCH endpoint to update tags on an existing task"
```

---

### Task 5: Pending tagged-tasks endpoint (feeds the home banner)

**Files:**
- Modify: `backend/internal/handlers/task/tag_service.go` (add GetPendingTaggedTasks)
- Modify: `backend/internal/handlers/task/tag_operations.go` (add operation)
- Modify: `backend/internal/handlers/task/routes.go`
- Test: extend `backend/internal/handlers/task/tag_service_test.go`

- [ ] **Step 1: Write the failing test**

```go
func (s *TagServiceTestSuite) TestGetPendingTaggedTasks_ReturnsTaskAndTagger() {
	owner := s.GetUser(0)
	friend := s.GetUser(1)
	categoryID := s.GetCategoryID(owner.ID)

	tagged, _ := s.service.BuildTaggedUsers([]string{friend.ID.Hex()})
	task := TaskDocument{ID: primitive.NewObjectID(), Content: "Read 30 mins", Priority: 1, Value: 2,
		UserID: owner.ID, CategoryID: categoryID, Active: true, TaggedUsers: tagged}
	_, err := s.service.CreateTask(categoryID, &task)
	s.NoError(err)

	pending, err := s.service.GetPendingTaggedTasks(friend.ID)
	s.NoError(err)
	s.Len(pending, 1)
	s.Equal("Read 30 mins", pending[0].Content)
	s.Equal(owner.ID, pending[0].Tagger.ID)
	s.Equal(owner.DisplayName, pending[0].Tagger.DisplayName)

	// Owner themselves has no pending tags
	none, err := s.service.GetPendingTaggedTasks(owner.ID)
	s.NoError(err)
	s.Len(none, 0)
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/task/... -run TestTagService -v`
Expected: compile error — `GetPendingTaggedTasks undefined`.

- [ ] **Step 3: Implement the aggregation**

Add to `tag_service.go`:

```go
type TaggerInfo struct {
	ID             primitive.ObjectID `bson:"id" json:"id"`
	DisplayName    string             `bson:"display_name" json:"display_name"`
	Handle         string             `bson:"handle" json:"handle"`
	ProfilePicture string             `bson:"profile_picture" json:"profile_picture"`
}

// PendingTaggedTask carries everything the home banner and the Copy prefill
// need in one payload.
type PendingTaggedTask struct {
	TaskID         primitive.ObjectID    `bson:"taskId" json:"taskId"`
	Content        string                `bson:"content" json:"content"`
	Value          float64               `bson:"value" json:"value"`
	Priority       int                   `bson:"priority" json:"priority"`
	Recurring      bool                  `bson:"recurring" json:"recurring"`
	RecurFrequency string                `bson:"recurFrequency,omitempty" json:"recurFrequency,omitempty"`
	RecurDetails   *RecurDetails         `bson:"recurDetails,omitempty" json:"recurDetails,omitempty"`
	Deadline       *time.Time            `bson:"deadline,omitempty" json:"deadline,omitempty"`
	Notes          string                `bson:"notes,omitempty" json:"notes,omitempty"`
	Checklist      []ChecklistItem       `bson:"checklist,omitempty" json:"checklist,omitempty"`
	Tagger         TaggerInfo            `bson:"tagger" json:"tagger"`
}

// GetPendingTaggedTasks returns every active task where userID is tagged with
// status pending, joined with the tagger's display info.
func (s *Service) GetPendingTaggedTasks(userID primitive.ObjectID) ([]PendingTaggedTask, error) {
	ctx := context.Background()
	elem := bson.M{"$elemMatch": bson.M{"id": userID, "status": types.TagStatusPending}}

	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"tasks.taggedUsers": elem}}},
		{{Key: "$unwind", Value: "$tasks"}},
		{{Key: "$match", Value: bson.M{"tasks.taggedUsers": elem}}},
		{{Key: "$lookup", Value: bson.M{
			"from": "users", "localField": "user", "foreignField": "_id", "as": "taggerDoc",
		}}},
		{{Key: "$unwind", Value: "$taggerDoc"}},
		{{Key: "$project", Value: bson.M{
			"taskId":         "$tasks._id",
			"content":        "$tasks.content",
			"value":          "$tasks.value",
			"priority":       "$tasks.priority",
			"recurring":      "$tasks.recurring",
			"recurFrequency": "$tasks.recurFrequency",
			"recurDetails":   "$tasks.recurDetails",
			"deadline":       "$tasks.deadline",
			"notes":          "$tasks.notes",
			"checklist":      "$tasks.checklist",
			"tagger": bson.M{
				"id":              "$taggerDoc._id",
				"display_name":    "$taggerDoc.display_name",
				"handle":          "$taggerDoc.handle",
				"profile_picture": "$taggerDoc.profile_picture",
			},
		}}},
		{{Key: "$sort", Value: bson.M{"taskId": -1}}}, // newest first (ObjectID encodes time)
	}

	cursor, err := s.Tasks.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	results := make([]PendingTaggedTask, 0)
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}
	return results, nil
}
```

Add imports as needed (`time`, `go.mongodb.org/mongo-driver/mongo`).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/task/... -run TestTagService -v`
Expected: PASS. If the tagger join comes back empty, check the categories collection's owner field name — `getBaseTaskPipeline` (task_service.go:42) references `"$user"`, so the field is `user`; verify the test fixture writes it the same way.

- [ ] **Step 5: Add the HTTP operation**

Add to `tag_operations.go`:

```go
type GetPendingTaggedTasksInput struct {
	Authorization string `header:"Authorization" required:"true"`
}

type GetPendingTaggedTasksOutput struct {
	Body []PendingTaggedTask `json:"body"`
}

func (h *Handler) GetPendingTaggedTasks(ctx context.Context, input *GetPendingTaggedTasksInput) (*GetPendingTaggedTasksOutput, error) {
	contextID, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Please log in to continue", err)
	}
	userObjID, err := primitive.ObjectIDFromHex(contextID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	pending, err := h.service.GetPendingTaggedTasks(userObjID)
	if err != nil {
		return nil, huma.Error500InternalServerError("Unable to fetch pending tags", err)
	}
	return &GetPendingTaggedTasksOutput{Body: pending}, nil
}

func RegisterGetPendingTaggedTasksOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-pending-tagged-tasks",
		Method:      http.MethodGet,
		Path:        "/v1/user/tagged-tasks",
		Summary:     "Get pending tagged tasks",
		Description: "Tasks the signed-in user has been tagged in and not yet responded to",
		Tags:        []string{"tasks"},
	}, handler.GetPendingTaggedTasks)
}
```

Register in `routes.go`: `RegisterGetPendingTaggedTasksOperation(api, handler)`.

- [ ] **Step 6: Build + commit**

Run: `cd /Users/abhik.ray/Kindred/backend && go build ./... && go test ./internal/handlers/task/... -run TestTagService -v`

```bash
git add backend/internal/handlers/task/
git commit -m "feat(tags): GET /v1/user/tagged-tasks pending-tags endpoint"
```

---

### Task 6: Respond to a tag (watch / copied / untagged) — POST endpoint

**Files:**
- Modify: `backend/internal/handlers/task/tag_service.go` (RespondToTaskTag)
- Modify: `backend/internal/handlers/task/tag_notifications.go` (notifyTaskCopied)
- Modify: `backend/internal/handlers/task/tag_operations.go`, `routes.go`
- Test: extend `backend/internal/handlers/task/tag_service_test.go`

- [ ] **Step 1: Write the failing tests**

```go
func (s *TagServiceTestSuite) TestRespondToTaskTag_UpdatesStatusAndTemplate() {
	owner := s.GetUser(0)
	friend := s.GetUser(1)
	categoryID := s.GetCategoryID(owner.ID)

	tagged, _ := s.service.BuildTaggedUsers([]string{friend.ID.Hex()})

	// Recurring task with a template so we can assert the mirror
	templateID := primitive.NewObjectID()
	s.InsertTemplate(types.TemplateTaskDocument{ // mirror however service_test.go seeds template-tasks; if no helper exists, insert directly into s.Collections["template-tasks"]
		ID: templateID, UserID: owner.ID, CategoryID: categoryID,
		Content: "Read 30 mins", RecurType: "OCCURRENCE", TaggedUsers: tagged,
	})

	task := TaskDocument{ID: primitive.NewObjectID(), Content: "Read 30 mins", Priority: 1, Value: 2,
		UserID: owner.ID, CategoryID: categoryID, Active: true,
		TemplateID: &templateID, TaggedUsers: tagged}
	created, err := s.service.CreateTask(categoryID, &task)
	s.NoError(err)

	err = s.service.RespondToTaskTag(created.ID, friend.ID, types.TagStatusWatching)
	s.NoError(err)

	fetched, err := s.service.GetTaskByID(created.ID, owner.ID)
	s.NoError(err)
	s.Equal(types.TagStatusWatching, fetched.TaggedUsers[0].Status)

	tmpl, err := s.service.GetTemplateByID(templateID)
	s.NoError(err)
	s.Equal(types.TagStatusWatching, tmpl.TaggedUsers[0].Status)
}

func (s *TagServiceTestSuite) TestRespondToTaskTag_RejectsInvalidStatus() {
	err := s.service.RespondToTaskTag(primitive.NewObjectID(), primitive.NewObjectID(), "bogus")
	s.Error(err)
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/task/... -run TestTagService -v`
Expected: compile error — `RespondToTaskTag undefined`.

- [ ] **Step 3: Implement RespondToTaskTag**

Add to `tag_service.go`:

```go
// RespondToTaskTag records the tagged user's response on the live task and
// mirrors it to the template so future recurrences inherit it. The nested
// array filter scopes the write to the responder's own entry, so a user can
// never modify someone else's tag state.
func (s *Service) RespondToTaskTag(taskID, responderID primitive.ObjectID, status string) error {
	if status != types.TagStatusWatching && status != types.TagStatusCopied && status != types.TagStatusUntagged {
		return fmt.Errorf("invalid tag status: %q", status)
	}
	ctx := context.Background()

	res, err := s.Tasks.UpdateOne(ctx,
		bson.M{"tasks._id": taskID},
		bson.M{"$set": bson.M{"tasks.$[t].taggedUsers.$[u].status": status}},
		options.Update().SetArrayFilters(options.ArrayFilters{
			Filters: bson.A{
				bson.M{"t._id": taskID},
				bson.M{"u.id": responderID},
			},
		}),
	)
	if err != nil {
		return err
	}
	if res.MatchedCount == 0 {
		return mongo.ErrNoDocuments
	}

	// Mirror to template (cross-user fetch: responder doesn't own the category)
	pipeline := append(
		[]bson.D{{{Key: "$match", Value: bson.M{"tasks._id": taskID}}}},
		getBaseTaskPipeline()...,
	)
	pipeline = append(pipeline, bson.D{{Key: "$match", Value: bson.M{"_id": taskID}}})
	cursor, err := s.Tasks.Aggregate(ctx, pipeline)
	if err != nil {
		return nil // status already saved; mirror is best-effort
	}
	defer cursor.Close(ctx)
	var tasks []TaskDocument
	if err := cursor.All(ctx, &tasks); err != nil || len(tasks) == 0 {
		return nil
	}
	task := tasks[0]
	if task.TemplateID != nil {
		if _, err := s.TemplateTasks.UpdateOne(ctx,
			bson.M{"_id": *task.TemplateID},
			bson.M{"$set": bson.M{"taggedUsers.$[u].status": status}},
			options.Update().SetArrayFilters(options.ArrayFilters{
				Filters: bson.A{bson.M{"u.id": responderID}},
			}),
		); err != nil {
			slog.Error("Failed to mirror tag response to template", "templateID", task.TemplateID.Hex(), "error", err)
		}
	}
	return nil
}
```

Add imports (`fmt`, `go.mongodb.org/mongo-driver/mongo/options`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/task/... -run TestTagService -v`
Expected: PASS.

- [ ] **Step 5: Implement notifyTaskCopied**

Add to `tag_notifications.go`:

```go
// notifyTaskCopied tells the task owner that a tagged friend copied the task.
// Push + TASK_COPIED record; best-effort.
func (s *Service) notifyTaskCopied(taskID, ownerID, copierID primitive.ObjectID, taskName string) {
	ctx := context.Background()

	copier, err := s.Users.GetUserByID(ctx, copierID)
	if err != nil || copier == nil {
		return
	}

	content := fmt.Sprintf("copied your task \"%s\" 💪", taskName)
	if err := s.NotificationService.CreateNotification(
		copierID, ownerID, content, notifications.NotificationTypeTaskCopied, taskID,
	); err != nil {
		slog.Error("Failed to create TASK_COPIED record", "owner", ownerID, "error", err)
	}

	owner, err := s.Users.GetUserByID(ctx, ownerID)
	if err != nil || owner == nil || owner.PushToken == "" {
		return
	}
	_ = xutils.SendNotification(xutils.Notification{
		Token:   owner.PushToken,
		Title:   "Your task caught on 💪",
		Message: fmt.Sprintf("%s copied your task \"%s\"", copier.DisplayName, taskName),
		Data: map[string]string{
			"type":    "task_copied",
			"task_id": taskID.Hex(),
			"user_id": copierID.Hex(),
		},
	})
}
```

- [ ] **Step 6: Add the HTTP operation**

Add to `tag_operations.go`:

```go
type RespondToTaskTagInput struct {
	Authorization string `header:"Authorization" required:"true"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
	Body          struct {
		Status string `json:"status" enum:"watching,copied,untagged"`
	} `json:"body"`
}

type RespondToTaskTagOutput struct {
	Body struct {
		Message string `json:"message" example:"Response recorded"`
	} `json:"body"`
}

func (h *Handler) RespondToTaskTag(ctx context.Context, input *RespondToTaskTagInput) (*RespondToTaskTagOutput, error) {
	taskID, err := primitive.ObjectIDFromHex(input.ID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid task ID format", err)
	}
	contextID, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Please log in to continue", err)
	}
	responderID, err := primitive.ObjectIDFromHex(contextID)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	if err := h.service.RespondToTaskTag(taskID, responderID, input.Body.Status); err != nil {
		return nil, huma.Error500InternalServerError("Unable to record response", err)
	}

	if input.Body.Status == types.TagStatusCopied {
		// Fetch owner + name for the notification (cross-user pipeline)
		if task, owner := h.service.lookupTaskAndOwner(taskID); task != nil {
			go h.service.notifyTaskCopied(taskID, owner, responderID, task.Content)
		}
	}

	resp := &RespondToTaskTagOutput{}
	resp.Body.Message = "Response recorded"
	return resp, nil
}

func RegisterRespondToTaskTagOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "respond-to-task-tag",
		Method:      http.MethodPost,
		Path:        "/v1/user/tagged-tasks/{id}/respond",
		Summary:     "Respond to a task tag",
		Description: "Watch, copy, or untag yourself from a task you were tagged in",
		Tags:        []string{"tasks"},
	}, handler.RespondToTaskTag)
}
```

And the small lookup helper in `tag_service.go`:

```go
// lookupTaskAndOwner fetches a task across all users' categories. Returns the
// task and its owner's ID (zero ID when not found).
func (s *Service) lookupTaskAndOwner(taskID primitive.ObjectID) (*TaskDocument, primitive.ObjectID) {
	ctx := context.Background()
	pipeline := append(
		[]bson.D{{{Key: "$match", Value: bson.M{"tasks._id": taskID}}}},
		getBaseTaskPipeline()...,
	)
	pipeline = append(pipeline, bson.D{{Key: "$match", Value: bson.M{"_id": taskID}}})
	cursor, err := s.Tasks.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, primitive.NilObjectID
	}
	defer cursor.Close(ctx)
	var tasks []TaskDocument
	if err := cursor.All(ctx, &tasks); err != nil || len(tasks) == 0 {
		return nil, primitive.NilObjectID
	}
	return &tasks[0], tasks[0].UserID
}
```

Register in `routes.go`: `RegisterRespondToTaskTagOperation(api, handler)`.

- [ ] **Step 7: Build, test, commit**

Run: `cd /Users/abhik.ray/Kindred/backend && go build ./... && go test ./internal/handlers/task/... -run TestTagService -v`
Expected: PASS.

```bash
git add backend/internal/handlers/task/
git commit -m "feat(tags): respond endpoint (watch/copy/untag) with copied notification"
```

---

### Task 7: Watcher pushes on task completion

**Files:**
- Modify: `backend/internal/handlers/task/tag_notifications.go` (NotifyTagWatchersOfCompletion)
- Modify: `backend/internal/handlers/task/task_service.go` (CompleteTask, ~line 508 next to the `NotifyEncouragersOfCompletion` call)
- Test: extend `backend/internal/handlers/task/tag_service_test.go`

- [ ] **Step 1: Write the failing test**

Mirror the push-sender stubbing from `encouragement/service_test.go:651` (`TestNotifyEncouragersOfCompletion_Success`) — same mock, same assertion style:

```go
func (s *TagServiceTestSuite) TestNotifyTagWatchersOfCompletion_OnlyPendingAndWatching() {
	owner := s.GetUser(0)
	watcher := s.GetUser(1)
	copier := s.GetUser(2)

	task := TaskDocument{
		ID: primitive.NewObjectID(), Content: "Read 30 mins", UserID: owner.ID,
		TaggedUsers: []types.TaggedTaskUser{
			{ID: watcher.ID, Handle: watcher.Handle, DisplayName: watcher.DisplayName, Status: types.TagStatusWatching},
			{ID: copier.ID, Handle: copier.Handle, DisplayName: copier.DisplayName, Status: types.TagStatusCopied},
		},
	}

	err := s.service.NotifyTagWatchersOfCompletion(&task, owner.ID)
	s.NoError(err)
	// Assert exactly one push was sent (to the watcher) using the mock sender,
	// following the assertion pattern in encouragement/service_test.go.
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/task/... -run TestTagService -v`
Expected: compile error — `NotifyTagWatchersOfCompletion undefined`.

- [ ] **Step 3: Implement**

Add to `tag_notifications.go`:

```go
// NotifyTagWatchersOfCompletion pushes to every tagged user still in pending
// or watching state. Push-only by design (spec: completion is a ping, not an
// activity-feed event). copied/untagged users are never pinged.
func (s *Service) NotifyTagWatchersOfCompletion(task *TaskDocument, ownerID primitive.ObjectID) error {
	ctx := context.Background()

	owner, err := s.Users.GetUserByID(ctx, ownerID)
	if err != nil || owner == nil {
		return err
	}

	for _, tu := range task.TaggedUsers {
		if tu.Status != types.TagStatusPending && tu.Status != types.TagStatusWatching {
			continue
		}
		receiver, err := s.Users.GetUserByID(ctx, tu.ID)
		if err != nil || receiver == nil || receiver.PushToken == "" {
			continue
		}
		notification := xutils.Notification{
			Token:   receiver.PushToken,
			Title:   "They did it! 🎉",
			Message: fmt.Sprintf("%s completed \"%s\" 🎉", owner.DisplayName, task.Content),
			Data: map[string]string{
				"type":    "task_completed_watcher",
				"user_id": ownerID.Hex(),
				"task_id": task.ID.Hex(),
			},
		}
		if err := xutils.SendNotification(notification); err != nil {
			slog.Error("Failed to send watcher completion push", "receiver", tu.ID, "error", err)
		}
	}
	return nil
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/task/... -run TestTagService -v`
Expected: PASS.

- [ ] **Step 5: Hook into CompleteTask**

In `task_service.go` `CompleteTask`, find the `NotifyEncouragersOfCompletion` call (`grep -n "NotifyEncouragersOfCompletion" task_service.go`). Directly after it, add:

```go
	if len(taskToComplete.TaggedUsers) > 0 {
		go func() {
			if err := s.NotifyTagWatchersOfCompletion(&taskToComplete, userId); err != nil {
				slog.Error("Failed to notify tag watchers", "taskID", taskToComplete.ID.Hex(), "error", err)
			}
		}()
	}
```

(Note: `BulkCompleteTask` intentionally does not ping watchers in v1 — single completion is the accountability moment. If bulk-complete pings are wanted later, hook the same helper there.)

- [ ] **Step 6: Build, run the full task test suite, commit**

Run: `cd /Users/abhik.ray/Kindred/backend && go build ./... && go test ./internal/handlers/task/... -v`
Expected: all task package tests PASS (including pre-existing ones).

```bash
git add backend/internal/handlers/task/
git commit -m "feat(tags): push watchers when a tagged task is completed"
```

---

### Task 8: Tags survive recurrence

**Files:**
- Modify: `backend/internal/handlers/task/util.go` (constructTaskFromTemplate, ~line 353)
- Test: extend `backend/internal/handlers/task/tag_service_test.go`

- [ ] **Step 1: Write the failing test**

```go
func (s *TagServiceTestSuite) TestConstructTaskFromTemplate_CopiesTaggedUsers() {
	friend := s.GetUser(1)
	tmpl := types.TemplateTaskDocument{
		ID: primitive.NewObjectID(), Content: "Read 30 mins", RecurType: "OCCURRENCE",
		TaggedUsers: []types.TaggedTaskUser{
			{ID: friend.ID, Handle: friend.Handle, DisplayName: friend.DisplayName, Status: types.TagStatusWatching},
		},
	}

	task := constructTaskFromTemplate(&tmpl)

	s.Len(task.TaggedUsers, 1)
	s.Equal(types.TagStatusWatching, task.TaggedUsers[0].Status)
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/task/... -run TestTagService -v`
Expected: FAIL — `task.TaggedUsers` empty.

- [ ] **Step 3: Implement**

In `util.go` `constructTaskFromTemplate` (~line 363), add to the `TaskDocument{...}` literal:

```go
		TaggedUsers:    templateDoc.TaggedUsers,
```

- [ ] **Step 4: Run test to verify it passes, commit**

Run: `cd /Users/abhik.ray/Kindred/backend && go test ./internal/handlers/task/... -run TestTagService -v`
Expected: PASS.

```bash
git add backend/internal/handlers/task/
git commit -m "feat(tags): recurring instances inherit tag state from template"
```

---

## Frontend

### Task 9: Frontend types + API client functions

**Files:**
- Modify: `frontend/api/types.ts` (Task interface ~line 92)
- Modify: `frontend/api/task.ts`

- [ ] **Step 1: Add types**

In `frontend/api/types.ts`, above the `Task` interface, add:

```typescript
export type TagStatus = "pending" | "watching" | "copied" | "untagged";

export interface TaggedTaskUser {
    id: string;
    handle: string;
    display_name: string;
    profile_picture?: string;
    status: TagStatus;
}

export interface PendingTaggedTask {
    taskId: string;
    content: string;
    value: number;
    priority: number;
    recurring: boolean;
    recurFrequency?: string;
    recurDetails?: RecurDetails;
    deadline?: string;
    notes?: string;
    checklist?: ChecklistItem[];
    tagger: {
        id: string;
        display_name: string;
        handle: string;
        profile_picture?: string;
    };
}
```

In the `Task` interface, after `encouragements?: TaskKudos[];`, add:

```typescript
    taggedUsers?: TaggedTaskUser[];
```

- [ ] **Step 2: Add API functions**

In `frontend/api/task.ts` (match the file's existing style — it uses `request` from `@/hooks/useRequest` and a logger), add:

```typescript
import type { PendingTaggedTask, TaggedTaskUser, TagStatus } from "./types";

export const updateTaskTagsAPI = async (
    categoryId: string,
    taskId: string,
    taggedUserIds: string[]
): Promise<{ taggedUsers: TaggedTaskUser[] }> => {
    return await request("PATCH", `/user/tasks/${categoryId}/${taskId}/tags`, { taggedUserIds });
};

export const getPendingTaggedTasksAPI = async (): Promise<PendingTaggedTask[]> => {
    return await request("GET", "/user/tagged-tasks");
};

export const respondToTaskTagAPI = async (
    taskId: string,
    status: Exclude<TagStatus, "pending">
): Promise<void> => {
    await request("POST", `/user/tagged-tasks/${taskId}/respond`, { status });
};
```

Check the top of `task.ts` for how `request` is imported (it may be `const { request } = useRequest()` pattern or a direct import like `api/notifications.ts:4` uses — copy `notifications.ts`'s direct `import { request } from "@/hooks/useRequest"` if `task.ts` doesn't already import it).

- [ ] **Step 3: Typecheck + commit**

Run: `cd /Users/abhik.ray/Kindred/frontend && bun x tsc --noEmit`
Expected: no new errors (pre-existing errors, if any, are unchanged — note them before starting).

```bash
git add frontend/api/types.ts frontend/api/task.ts
git commit -m "feat(tags): frontend types and API client for task tagging"
```

---

### Task 10: Extract shared FriendPicker from tag-people

**Files:**
- Create: `frontend/components/inputs/FriendPicker.tsx`
- Modify: `frontend/app/(logged-in)/posting/tag-people.tsx` (refactor to use it — zero behavior change)

- [ ] **Step 1: Create FriendPicker**

Move the search input + FlatList + FriendRow out of `tag-people.tsx` into `frontend/components/inputs/FriendPicker.tsx`:

```typescript
import React, { useMemo, useState } from "react";
import { FlatList, TouchableOpacity, View } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import ThemedInput from "@/components/inputs/ThemedInput";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useFriendsForMention, MentionCandidate } from "@/hooks/useFriendsForMention";
import { Ionicons } from "@expo/vector-icons";
import { formatHandle } from "@/utils/handle";

type Props = {
    selectedIds: Set<string>;
    onToggle: (candidate: MentionCandidate) => void;
    /** Friend IDs that can't be toggled off (e.g. tags already responded to). */
    lockedIds?: Set<string>;
};

const FriendPicker = ({ selectedIds, onToggle, lockedIds }: Props) => {
    const ThemedColor = useThemeColor();
    const [query, setQuery] = useState("");
    const { filter } = useFriendsForMention();
    const matches = useMemo(() => filter(query), [query, filter]);

    return (
        <View style={{ flex: 1, gap: 12 }}>
            <ThemedInput value={query} setValue={setQuery} placeHolder="Search friends" />
            <FlatList
                data={matches}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <FriendRow
                        item={item}
                        checked={selectedIds.has(item.id)}
                        locked={lockedIds?.has(item.id) ?? false}
                        onToggle={onToggle}
                        primaryColor={ThemedColor.primary}
                        captionColor={ThemedColor.caption}
                    />
                )}
            />
        </View>
    );
};

type FriendRowProps = {
    item: MentionCandidate;
    checked: boolean;
    locked: boolean;
    onToggle: (c: MentionCandidate) => void;
    primaryColor: string;
    captionColor: string;
};

function FriendRow({ item, checked, locked, onToggle, primaryColor, captionColor }: FriendRowProps) {
    return (
        <TouchableOpacity
            disabled={locked}
            onPress={() => onToggle(item)}
            style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 12, opacity: locked ? 0.5 : 1 }}>
            <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold">{item.display_name}</ThemedText>
                <ThemedText type="caption">{formatHandle(item.handle)}</ThemedText>
            </View>
            <Ionicons
                name={checked ? "checkmark-circle" : "ellipse-outline"}
                size={22}
                color={checked ? primaryColor : captionColor}
            />
        </TouchableOpacity>
    );
}

export default FriendPicker;
```

- [ ] **Step 2: Refactor tag-people.tsx to use it**

Replace the body of `tag-people.tsx` so the search/list portion renders `<FriendPicker selectedIds={...} onToggle={toggle} />` while keeping the header (back arrow, "Tag people" title, Done button) and the `usePostComposer` wiring identical. `selectedIds` is derived: `new Set(selected.keys())`. The `toggle` and `done` functions stay as they are.

- [ ] **Step 3: Verify no behavior change**

Run: `cd /Users/abhik.ray/Kindred/frontend && bun x tsc --noEmit`
Expected: clean. Manually confirm `tag-people.tsx` no longer defines its own FriendRow/FlatList (the only render path is FriendPicker).

- [ ] **Step 4: Commit**

```bash
git add frontend/components/inputs/FriendPicker.tsx "frontend/app/(logged-in)/posting/tag-people.tsx"
git commit -m "refactor: extract FriendPicker from tag-people for reuse"
```

---

### Task 11: Tagging in the create flow

**Files:**
- Modify: `frontend/contexts/taskCreationContext.tsx`
- Modify: `frontend/components/modals/create/Collaborators.tsx` (replace placeholder)
- Modify: `frontend/components/modals/create/Standard.tsx` (advanced option + postBody + copy-respond)

- [ ] **Step 1: Extend TaskCreationContext**

In `frontend/contexts/taskCreationContext.tsx`:

Add to the type (after `integration`/`setIntegration`):

```typescript
    taggedUsers: TaggedUser[];
    setTaggedUsers: (users: TaggedUser[]) => void;
    /** Notes/checklist prefill — used by the tag Copy flow; create otherwise sends empty. */
    notes: string;
    setNotes: (notes: string) => void;
    checklist: ChecklistItem[];
    setChecklist: (items: ChecklistItem[]) => void;
    /** When set, a successful create marks this original task's tag as "copied". */
    copySourceTaskId: string | null;
    setCopySourceTaskId: (id: string | null) => void;
```

Imports: `import type { TaggedUser } from "@/components/inputs/TaggedUsersChips";` and `import type { ChecklistItem } from "@/api/types";` (check the exact exported name in `api/types.ts` — adjust if it differs).

Add state in the provider:

```typescript
    const [taggedUsers, setTaggedUsers] = useState<TaggedUser[]>([]);
    const [notes, setNotes] = useState("");
    const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
    const [copySourceTaskId, setCopySourceTaskId] = useState<string | null>(null);
```

In `resetTaskCreation`, add:

```typescript
        setTaggedUsers([]);
        setNotes("");
        setChecklist([]);
        setCopySourceTaskId(null);
```

In `loadTaskData`, add:

```typescript
        setNotes(taskData.notes || "");
        setChecklist(taskData.checklist || []);
        setTaggedUsers([]);
```

Add all eight new values to `contextValue` and the new state to the `useMemo` dependency array.

- [ ] **Step 2: Replace the Collaborators placeholder screen**

Rewrite `frontend/components/modals/create/Collaborators.tsx`:

```typescript
import React from "react";
import { View, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import Feather from "@expo/vector-icons/Feather";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import FriendPicker from "@/components/inputs/FriendPicker";
import TaggedUsersChips from "@/components/inputs/TaggedUsersChips";
import type { MentionCandidate } from "@/hooks/useFriendsForMention";

type Props = {
    goToStandard: () => void;
};

const Collaborators = ({ goToStandard }: Props) => {
    const ThemedColor = useThemeColor();
    const { taggedUsers, setTaggedUsers } = useTaskCreation();

    const toggle = (c: MentionCandidate) => {
        if (taggedUsers.some((u) => u.id === c.id)) {
            setTaggedUsers(taggedUsers.filter((u) => u.id !== c.id));
        } else {
            setTaggedUsers([...taggedUsers, { id: c.id, handle: c.handle, display_name: c.display_name }]);
        }
    };

    return (
        <View style={{ gap: 16, flex: 1 }}>
            <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
                <TouchableOpacity onPress={goToStandard}>
                    <Feather name="arrow-left" size={24} color={ThemedColor.text} />
                </TouchableOpacity>
                <ThemedText type="defaultSemiBold">Tag friends</ThemedText>
            </View>
            <TaggedUsersChips users={taggedUsers} onRemove={(id) => setTaggedUsers(taggedUsers.filter((u) => u.id !== id))} />
            <FriendPicker selectedIds={new Set(taggedUsers.map((u) => u.id))} onToggle={toggle} />
        </View>
    );
};

export default Collaborators;
```

(Note: `TaggedUsersChips` has `paddingHorizontal: 16` baked in; if it looks double-padded inside the modal, pass-through styling fix is acceptable but don't restructure the component.)

- [ ] **Step 3: Wire Standard.tsx**

In `frontend/components/modals/create/Standard.tsx`:

1. Pull the new fields in the `useTaskCreation()` destructure: `taggedUsers`, `notes`, `checklist`, `copySourceTaskId`, `setCopySourceTaskId`.
2. In `createPost`, in `postBody`, replace the hardcoded `checklist: []` and `notes: ""` with `checklist: checklist`, `notes: notes`, and add:

```typescript
            taggedUserIds: taggedUsers.length > 0 ? taggedUsers.map((u) => u.id) : undefined,
```

3. Also update the `optimisticTask` to carry `notes` and `checklist` (same values) so the optimistic card matches.
4. After the successful `request("POST", ...)` (right after `addToCategory(selectedCategory.id, response)`), add:

```typescript
            if (copySourceTaskId) {
                const { respondToTaskTagAPI } = await import("@/api/task");
                respondToTaskTagAPI(copySourceTaskId, "copied").catch(() => {});
                setCopySourceTaskId(null);
                queryClient.invalidateQueries({ queryKey: ["taskTags", "pending"] });
            }
```

5. In `AdvancedOptionList`, replace the commented-out Collaborators block (~line 859-866) with a live option, create-mode only. `AdvancedOptionList` needs an `edit` prop passed down from `Standard` (`<AdvancedOptionList goTo={goTo} showUnconfigured={...} edit={edit} />` at both call sites, ~line 515 and ~536):

```typescript
            {!edit && (
                <AdvancedOption
                    icon="people"
                    label={
                        taggedUsers.length > 0
                            ? `Tagged: ${taggedUsers.map((u) => u.handle).join(", ")}`
                            : "Tag friends"
                    }
                    screen={Screen.COLLABORATORS}
                    goTo={goTo}
                    showUnconfigured={showUnconfigured}
                    configured={taggedUsers.length > 0}
                />
            )}
```

(`taggedUsers` comes from adding it to the `useTaskCreation()` destructure inside `AdvancedOptionList`. Handles already contain `@` — join them as-is.)

- [ ] **Step 4: Typecheck + commit**

Run: `cd /Users/abhik.ray/Kindred/frontend && bun x tsc --noEmit`
Expected: clean.

```bash
git add frontend/contexts/taskCreationContext.tsx frontend/components/modals/create/
git commit -m "feat(tags): tag friends from the create-task flow"
```

---

### Task 12: Home-screen tag banner (V2-B design)

**Files:**
- Create: `frontend/hooks/usePendingTaskTags.ts`
- Create: `frontend/components/dashboard/TaggedTaskBanner.tsx`
- Modify: `frontend/components/dashboard/HomescrollContent.tsx` (~line 336, first child of the MotiView)

- [ ] **Step 1: Create the query hook**

`frontend/hooks/usePendingTaskTags.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { getPendingTaggedTasksAPI } from "@/api/task";

export const PENDING_TAGS_KEY = ["taskTags", "pending"] as const;

export const usePendingTaskTags = () => {
    return useQuery({
        queryKey: PENDING_TAGS_KEY,
        queryFn: getPendingTaggedTasksAPI,
        staleTime: 60_000,
    });
};
```

- [ ] **Step 2: Create the banner component**

`frontend/components/dashboard/TaggedTaskBanner.tsx`. Design locked during brainstorming (V2-B): hairline top border in brand purple, avatar + "**[Name]** tagged you in a task" with task name · points below, three text actions in one row — **Watch** (purple, primary), **Copy**, **Untag me** (both caption gray). No card background, no nesting.

```typescript
import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTaskCreation } from "@/contexts/taskCreationContext";
import { useCreateModal } from "@/contexts/createModalContext";
import { respondToTaskTagAPI } from "@/api/task";
import { usePendingTaskTags, PENDING_TAGS_KEY } from "@/hooks/usePendingTaskTags";
import type { PendingTaggedTask } from "@/api/types";

const HORIZONTAL_PADDING = 16; // match HomescrollContent's constant — check its value and import/duplicate accordingly

export const TaggedTaskBanners = () => {
    const { data } = usePendingTaskTags();
    if (!data || data.length === 0) return null;
    return (
        <View style={{ gap: 4, marginHorizontal: HORIZONTAL_PADDING }}>
            {data.map((tag) => (
                <TaggedTaskBannerRow key={tag.taskId} tag={tag} />
            ))}
        </View>
    );
};

const TaggedTaskBannerRow = ({ tag }: { tag: PendingTaggedTask }) => {
    const ThemedColor = useThemeColor();
    const queryClient = useQueryClient();
    const { loadTaskData, setCopySourceTaskId } = useTaskCreation();
    const { openModal } = useCreateModal();

    const respond = useMutation({
        mutationFn: (status: "watching" | "untagged") => respondToTaskTagAPI(tag.taskId, status),
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: PENDING_TAGS_KEY });
            const prev = queryClient.getQueryData<PendingTaggedTask[]>(PENDING_TAGS_KEY);
            queryClient.setQueryData<PendingTaggedTask[]>(PENDING_TAGS_KEY, (old) =>
                (old ?? []).filter((t) => t.taskId !== tag.taskId)
            );
            return { prev };
        },
        onError: (_err, _status, ctx) => {
            if (ctx?.prev) queryClient.setQueryData(PENDING_TAGS_KEY, ctx.prev);
        },
    });

    // v1 scope note: openModal() presents the create sheet with the category
    // dropdown scoped to the user's currently selected workspace (that's how
    // useTasks().categories works). The spec's "pick workspace and category"
    // is satisfied for the common case; a pre-modal workspace picker is a
    // deliberate fast-follow, not part of this plan.
    const handleCopy = () => {
        setCopySourceTaskId(tag.taskId);
        loadTaskData({
            content: tag.content,
            value: tag.value,
            priority: tag.priority,
            recurring: tag.recurring,
            recurFrequency: tag.recurFrequency,
            recurDetails: tag.recurDetails,
            deadline: tag.deadline,
            notes: tag.notes,
            checklist: tag.checklist,
        });
        openModal();
    };

    return (
        <View style={{ borderTopWidth: 1, borderTopColor: ThemedColor.primary, paddingTop: 10, paddingBottom: 6, gap: 9 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Image
                    source={tag.tagger.profile_picture ? { uri: tag.tagger.profile_picture } : undefined}
                    style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: ThemedColor.primary }}
                />
                <View style={{ flex: 1 }}>
                    <ThemedText type="default">
                        <ThemedText type="defaultSemiBold">{tag.tagger.display_name}</ThemedText> tagged you in a task
                    </ThemedText>
                    <ThemedText type="caption">
                        {tag.content} · {tag.value} pts
                    </ThemedText>
                </View>
            </View>
            <View style={{ flexDirection: "row", gap: 24 }}>
                <TouchableOpacity onPress={() => respond.mutate("watching")} hitSlop={8}>
                    <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.primary }}>Watch</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleCopy} hitSlop={8}>
                    <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.caption }}>Copy</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => respond.mutate("untagged")} hitSlop={8}>
                    <ThemedText type="defaultSemiBold" style={{ color: ThemedColor.caption, opacity: 0.6 }}>Untag me</ThemedText>
                </TouchableOpacity>
            </View>
        </View>
    );
};
```

(Memory note applies: `expo-image` ignores RN `shadow*` props — this design has no shadow, so nothing to work around. Check how `HORIZONTAL_PADDING` is defined in HomescrollContent.tsx and reuse the same value/import.)

- [ ] **Step 3: Mount in HomescrollContent**

In `frontend/components/dashboard/HomescrollContent.tsx`, import `{ TaggedTaskBanners } from "./TaggedTaskBanner"` and render it as the first child inside the `<MotiView style={{ gap: 16, marginTop: 0 }}>` (~line 336), above the DashboardStats block:

```tsx
            <MotiView style={{ gap: 16, marginTop: 0 }}>
                <TaggedTaskBanners />
                {/* Dashboard Stats - always visible */}
```

Also wire pull-to-refresh: find where `onRefresh` is composed (in the home screen `index.tsx` or wherever the prop originates) and add `queryClient.invalidateQueries({ queryKey: ["taskTags", "pending"] })` alongside the existing refresh invalidations. If `onRefresh` lives outside this file, make the change where the other query invalidations already happen.

- [ ] **Step 4: Typecheck + commit**

Run: `cd /Users/abhik.ray/Kindred/frontend && bun x tsc --noEmit`
Expected: clean.

```bash
git add frontend/hooks/usePendingTaskTags.ts frontend/components/dashboard/
git commit -m "feat(tags): home-screen banner with Watch/Copy/Untag actions"
```

---

### Task 13: Tag entry point on the task detail screen

**Files:**
- Create: `frontend/components/modals/TagFriendsModal.tsx`
- Modify: `frontend/app/(logged-in)/(tabs)/(task)/task/[id].tsx` (header row ~line 571-585, next to the PencilSimple edit button)

- [ ] **Step 1: Create TagFriendsModal**

```typescript
import React, { useMemo, useState } from "react";
import { Modal, View, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import FriendPicker from "@/components/inputs/FriendPicker";
import { updateTaskTagsAPI } from "@/api/task";
import type { MentionCandidate } from "@/hooks/useFriendsForMention";
import type { Task } from "@/api/types";

type Props = {
    visible: boolean;
    onClose: () => void;
    task: Task;
    onTagsUpdated: (taggedUsers: Task["taggedUsers"]) => void;
};

const TagFriendsModal = ({ visible, onClose, task, onTagsUpdated }: Props) => {
    const insets = useSafeAreaInsets();
    const ThemedColor = useThemeColor();

    // Responded entries are locked: spec keeps removal-after-response out of scope
    const lockedIds = useMemo(
        () => new Set((task.taggedUsers ?? []).filter((t) => t.status !== "pending").map((t) => t.id)),
        [task.taggedUsers]
    );
    const [selected, setSelected] = useState<Set<string>>(
        () => new Set((task.taggedUsers ?? []).filter((t) => t.status !== "untagged").map((t) => t.id))
    );

    const toggle = (c: MentionCandidate) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(c.id)) next.delete(c.id);
            else next.add(c.id);
            return next;
        });
    };

    const save = async () => {
        try {
            const result = await updateTaskTagsAPI(task.categoryID!, task.id, Array.from(selected));
            onTagsUpdated(result.taggedUsers);
        } catch (error) {
            console.error("Failed to update tags:", error);
        }
        onClose();
    };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <ThemedView style={{ flex: 1, paddingTop: insets.top, paddingHorizontal: 16, gap: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12 }}>
                    <TouchableOpacity onPress={onClose} hitSlop={8}>
                        <ThemedText style={{ color: ThemedColor.caption }}>Cancel</ThemedText>
                    </TouchableOpacity>
                    <ThemedText type="subtitle" style={{ flex: 1, textAlign: "center" }}>Tag friends</ThemedText>
                    <TouchableOpacity onPress={save} hitSlop={8}>
                        <ThemedText style={{ color: ThemedColor.primary }}>Done</ThemedText>
                    </TouchableOpacity>
                </View>
                <FriendPicker selectedIds={selected} onToggle={toggle} lockedIds={lockedIds} />
            </ThemedView>
        </Modal>
    );
};

export default TagFriendsModal;
```

- [ ] **Step 2: Add the trigger to the detail screen**

In `[id].tsx`, in the header row containing the `PencilSimple` edit button (~line 581), wrap the two icons in a row and add a `UserPlus` (phosphor) button before the pencil:

```tsx
                        <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
                            <TouchableOpacity onPress={() => setShowTagModal(true)}>
                                <UserPlus size={24} color={ThemedColor.text} weight="regular" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleEditPress}>
                                <PencilSimple size={24} color={ThemedColor.text} weight="regular" />
                            </TouchableOpacity>
                        </View>
```

Add `const [showTagModal, setShowTagModal] = useState(false);`, import `UserPlus` from `phosphor-react-native` (alongside the existing `PencilSimple` import) and `TagFriendsModal`. Render at the bottom of the screen's JSX (only when a task is loaded):

```tsx
            {task && (
                <TagFriendsModal
                    visible={showTagModal}
                    onClose={() => setShowTagModal(false)}
                    task={task}
                    onTagsUpdated={(taggedUsers) => updateTask(task.categoryID!, task.id, { taggedUsers })}
                />
            )}
```

(`task` and `updateTask` come from `useTasks()` — check how `[id].tsx` already obtains the task object and its update helper, and use those exact names. If `updateTask`'s signature doesn't accept partials, refresh via the screen's existing task re-fetch path instead.)

- [ ] **Step 3: Typecheck + commit**

Run: `cd /Users/abhik.ray/Kindred/frontend && bun x tsc --noEmit`

```bash
git add frontend/components/modals/TagFriendsModal.tsx "frontend/app/(logged-in)/(tabs)/(task)/task/[id].tsx"
git commit -m "feat(tags): tag friends from the task detail screen"
```

---

### Task 14: Watcher glow on the task card

**Files:**
- Modify: `frontend/components/cards/encouragedTask.ts`
- Modify: `frontend/components/cards/TaskCard.tsx` (~line 98 and the EncouragerAvatars usage ~line 511)
- Modify: `frontend/components/cards/EncouragerAvatars.tsx`

- [ ] **Step 1: Extend the glow predicate**

In `encouragedTask.ts`, add:

```typescript
// A task is "watched" when a tagged friend is pending or actively watching.
export const isTaskWatched = (task?: Task | null): boolean =>
    (task?.taggedUsers ?? []).some((t) => t.status === "pending" || t.status === "watching");
```

- [ ] **Step 2: Apply in TaskCard**

In `TaskCard.tsx` line 98, change:

```typescript
    const encouraged = isTaskEncouraged(task) || isTaskWatched(task);
```

(import `isTaskWatched` alongside `isTaskEncouraged`). The glow, border, and text color now also light up for watched tasks — exactly the spec's "existing encouragements glow-icon treatment".

- [ ] **Step 3: Merge watchers into the avatar stack**

In `EncouragerAvatars.tsx`, add an optional `taggedUsers?: TaggedTaskUser[]` prop. Merge avatar sources before rendering: kudos senders (existing `encouragements[].sender.icon`) plus tagged users with status `pending`/`watching` (`profile_picture`), de-duplicated by user id, still capped at the existing max (3). Follow the component's existing avatar-rendering markup exactly — only the input list changes.

In `TaskCard.tsx` (~line 511), pass the new prop:

```tsx
    <EncouragerAvatars
        encouragements={task?.encouragements ?? []}
        taggedUsers={task?.taggedUsers ?? []}
        ringColor={ThemedColor.background}
        placeholderColor={ThemedColor.primary}
    />
```

And update the render condition from `encouraged` to the same merged flag used at line 98 (the variable already covers both after Step 2).

- [ ] **Step 4: Typecheck + commit**

Run: `cd /Users/abhik.ray/Kindred/frontend && bun x tsc --noEmit`

```bash
git add frontend/components/cards/
git commit -m "feat(tags): watcher glow + avatars on task cards"
```

---

### Task 15: Notification plumbing (frontend)

**Files:**
- Modify: `frontend/utils/notifications.ts`
- Modify: `frontend/components/notifications/NotificationsView.tsx` (~line 341 nav switch, ~line 438 type cast)
- Modify: `frontend/app/(logged-in)/_layout.tsx` (NotificationType union ~line 50-62, getNotificationRoute ~line 93)

- [ ] **Step 1: Extend ProcessedNotification types**

In `frontend/utils/notifications.ts`, add to the `type` union:

```typescript
        | "task_tagged"
        | "task_copied"
```

Add `"task_tagged"` and `"task_copied"` to `SUPPORTED_TYPES`.

- [ ] **Step 2: NotificationsView navigation cases**

In `NotificationsView.tsx`, find the navigation `switch` (~line 341) and add:

```typescript
            case "task_tagged":
                // Banner lives on home — send them there
                router.push("/(logged-in)/(tabs)/(task)");
                break;
            case "task_copied":
                router.push(`/(logged-in)/(tabs)/(task)/task/${notification.referenceId}`);
                break;
```

(Match the file's exact navigation idiom — if surrounding cases use `router.push(... as Href)` or a typed helper, do the same. Routes must be typed against `Href`, never `as any`.)

The `rawType.toLowerCase()` mapping (~line 404) converts `TASK_TAGGED` → `task_tagged` automatically; extend the union cast at ~line 438 to include the two new literals.

- [ ] **Step 3: Push deep-link routes**

In `_layout.tsx`:

1. Add `"task_tagged" | "task_copied" | "task_completed_watcher"` to the `NotificationType` union (~line 50-62).
2. In `getNotificationRoute`, add cases:

```typescript
        case "task_tagged":
            // Response banner lives on the home screen
            return "/(logged-in)/(tabs)/(task)";
        case "task_copied":
            if (data.task_id) {
                return `/(logged-in)/(tabs)/(task)/task/${data.task_id}`;
            }
            return "/(logged-in)/(tabs)/(task)";
        case "task_completed_watcher":
            if (data.user_id) {
                return `/(logged-in)/(tabs)/(feed,search,profile)/account/${data.user_id}`;
            }
            return "/(logged-in)/(tabs)/(task)";
```

- [ ] **Step 4: Typecheck + commit**

Run: `cd /Users/abhik.ray/Kindred/frontend && bun x tsc --noEmit`

```bash
git add frontend/utils/notifications.ts frontend/components/notifications/NotificationsView.tsx "frontend/app/(logged-in)/_layout.tsx"
git commit -m "feat(tags): notification types and deep-link routes for tagging"
```

---

### Task 16: Full verification

- [ ] **Step 1: Backend full test run**

Run: `cd /Users/abhik.ray/Kindred/backend && go vet ./... && go test ./...`
Expected: all packages PASS, vet clean.

- [ ] **Step 2: Frontend typecheck**

Run: `cd /Users/abhik.ray/Kindred/frontend && bun x tsc --noEmit`
Expected: no errors beyond any noted pre-existing baseline.

- [ ] **Step 3: Manual smoke checklist (two simulator accounts / TestFlight)**

1. User A creates a task, tags User B from the create sheet → B receives push; banner appears on B's home.
2. B taps **Watch** → banner dismisses; A's task card shows the glow + B's avatar.
3. A completes the task → B receives the "They did it! 🎉" push.
4. Repeat with **Copy** → create sheet opens pre-filled (content, points, deadline, recurrence, notes, checklist); B picks a workspace/category, saves → A receives "copied your task 💪" push; B's banner is gone.
5. Repeat with **Untag me** → banner gone silently; A gets nothing; A's glow/avatar for B disappears.
6. Tag from the task detail screen (UserPlus icon) → same push/banner behavior; already-responded friends show locked in the picker.
7. Recurring task: tag → B watches → A completes → next instance generated still carries B as watching (complete it again, B pinged again).

- [ ] **Step 4: Final commit if any fixups, then report**

```bash
git status   # confirm clean tree, all work committed
```
