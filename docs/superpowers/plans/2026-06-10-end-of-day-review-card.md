# End-of-Day Review Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A card pinned to the top of the home feed from 20:00–23:59 local that opens a bottom sheet where the user bulk-checks-off today's open tasks and quick-logs untracked things (created + completed in one go via a new `POST /v1/user/tasks/log` endpoint).

**Architecture:** Backend adds one Huma operation in the existing `task` handler package: find-or-create a "Logged" category (categories embed tasks; the task service's `Tasks` collection IS the categories collection), then per entry reuse `s.CreateTask` → `s.CompleteTask` → `s.DeleteTask` so streak/completed-tasks semantics stay identical to normal completion. Rings (Plan + Do per task) fire in the handler via the same fire-and-forget goroutine pattern as `BulkCompleteTask`. Frontend adds pure time/filter utils (jest-tested), a visibility hook backed by AsyncStorage, a card rendered in the feed's `ListHeaderComponent`, and a `DefaultModal` bottom sheet that calls the existing bulk-complete endpoint plus the new log endpoint.

**Tech Stack:** Go + Huma v2 + MongoDB driver (backend), Expo/React Native + openapi-typescript client + @gorhom/bottom-sheet via `DefaultModal` (frontend). Tests: testify suite (`testpkg.BaseSuite`, real Mongo) and jest.

**Spec:** `docs/superpowers/specs/2026-06-10-end-of-day-review-card-design.md`

**Conventions that apply to every task:**
- Work in worktree `/Users/abhik.ray/Kindred/.claude/worktrees/end-of-day-review-card` (branch `worktree-end-of-day-review-card`).
- Use `bun` (never `npx`) for all JS tooling.
- Frontend baseline has 4 pre-existing failing suites: `AboutScreen`, `dragHitTest`, `KudosItem`, `UserInfoEncouragementNotification`. They fail on clean main. Any OTHER failure is a regression you introduced.
- Backend task-package tests need a real Mongo and take ~90s: `go test ./internal/handlers/task/ -run <Name>` to scope.
- Comments: 2 lines max, only where the code can't say it.

---

### Task 1: Backend — `LogTasks` service method (TDD)

**Files:**
- Create: `backend/internal/handlers/task/log_service.go`
- Create: `backend/internal/handlers/task/log_service_test.go`

- [ ] **Step 1: Write the failing test**

Create `backend/internal/handlers/task/log_service_test.go`:

```go
package task

import (
	"testing"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"github.com/stretchr/testify/suite"
	"go.mongodb.org/mongo-driver/bson"
)

type LogServiceTestSuite struct {
	testpkg.BaseSuite
	service *Service
}

func (s *LogServiceTestSuite) SetupTest() {
	s.BaseSuite.SetupTest()
	s.service = NewService(s.Collections)
}

func TestLogService(t *testing.T) {
	suite.Run(t, new(LogServiceTestSuite))
}

func (s *LogServiceTestSuite) TestLogTasks_CreatesLoggedCategoryAndCompletesTasks() {
	user := s.GetUser(0)

	result, err := s.service.LogTasks(user.ID, "Personal", []string{"gym", "called mom"})
	s.NoError(err)
	s.Equal(2, result.TasksLogged)
	s.Empty(result.FailedIndices)

	// A "Logged" category exists in the workspace, with no open tasks left in it
	var category types.CategoryDocument
	err = s.Collections["categories"].FindOne(s.Ctx, bson.M{
		"user":          user.ID,
		"workspaceName": "Personal",
		"name":          "Logged",
	}).Decode(&category)
	s.NoError(err)
	s.Empty(category.Tasks, "logged tasks must not remain open in the category")

	// Both tasks landed in completed-tasks with a completion timestamp
	count, err := s.Collections["completed-tasks"].CountDocuments(s.Ctx, bson.M{
		"user":       user.ID,
		"categoryID": category.ID,
	})
	s.NoError(err)
	s.Equal(int64(2), count)

	var completed struct {
		Content       string `bson:"content"`
		Active        bool   `bson:"active"`
		TimeCompleted any    `bson:"timeCompleted"`
	}
	err = s.Collections["completed-tasks"].FindOne(s.Ctx, bson.M{
		"user": user.ID, "content": "gym",
	}).Decode(&completed)
	s.NoError(err)
	s.False(completed.Active)
	s.NotNil(completed.TimeCompleted)

	// User's lifetime completion count moved by 2
	userAfter, err := s.service.Users.GetUserByID(s.Ctx, user.ID)
	s.NoError(err)
	s.Equal(user.TasksComplete+2, userAfter.TasksComplete)
}

func (s *LogServiceTestSuite) TestLogTasks_ReusesExistingLoggedCategory() {
	user := s.GetUser(0)

	_, err := s.service.LogTasks(user.ID, "Personal", []string{"first"})
	s.NoError(err)
	_, err = s.service.LogTasks(user.ID, "Personal", []string{"second"})
	s.NoError(err)

	count, err := s.Collections["categories"].CountDocuments(s.Ctx, bson.M{
		"user":          user.ID,
		"workspaceName": "Personal",
		"name":          "Logged",
	})
	s.NoError(err)
	s.Equal(int64(1), count, "second call must reuse the Logged category")
}

func (s *LogServiceTestSuite) TestLogTasks_SeparateCategoriesPerWorkspace() {
	user := s.GetUser(0)

	_, err := s.service.LogTasks(user.ID, "Personal", []string{"a"})
	s.NoError(err)
	_, err = s.service.LogTasks(user.ID, "Work", []string{"b"})
	s.NoError(err)

	count, err := s.Collections["categories"].CountDocuments(s.Ctx, bson.M{
		"user": user.ID,
		"name": "Logged",
	})
	s.NoError(err)
	s.Equal(int64(2), count)
}
```

Note: if `user.TasksComplete` doesn't exist on the fixture user type, check what `s.GetUser(0)` returns (look at `backend/internal/testing/` BaseSuite) and read the field from `s.service.Users.GetUserByID(s.Ctx, user.ID)` before calling `LogTasks` instead.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/abhik.ray/Kindred/.claude/worktrees/end-of-day-review-card/backend
go test ./internal/handlers/task/ -run TestLogService -v 2>&1 | tail -20
```

Expected: compile error — `s.service.LogTasks undefined`.

- [ ] **Step 3: Write the implementation**

Create `backend/internal/handlers/task/log_service.go`:

```go
package task

import (
	"context"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const loggedCategoryName = "Logged"

type LogTasksResult struct {
	TasksLogged   int
	CurrentStreak int
	FailedIndices []int
}

// FindOrCreateLoggedCategory returns the user's "Logged" category for the
// workspace, creating it atomically (upsert) if absent.
func (s *Service) FindOrCreateLoggedCategory(userID primitive.ObjectID, workspaceName string) (*types.CategoryDocument, error) {
	ctx := context.Background()
	filter := bson.M{
		"user":          userID,
		"workspaceName": workspaceName,
		"name":          loggedCategoryName,
	}
	update := bson.M{
		"$setOnInsert": bson.M{
			"_id":           primitive.NewObjectID(),
			"name":          loggedCategoryName,
			"workspaceName": workspaceName,
			"lastEdited":    time.Now(),
			"tasks":         []TaskDocument{},
			"user":          userID,
		},
	}
	opts := options.FindOneAndUpdate().SetUpsert(true).SetReturnDocument(options.After)

	var category types.CategoryDocument
	if err := s.Tasks.FindOneAndUpdate(ctx, filter, update, opts).Decode(&category); err != nil {
		return nil, err
	}
	return &category, nil
}

// LogTasks creates and immediately completes one task per entry in the user's
// "Logged" category, reusing the standard create/complete/delete path so
// streaks and completed-tasks semantics match normal completion exactly.
func (s *Service) LogTasks(userID primitive.ObjectID, workspaceName string, contents []string) (*LogTasksResult, error) {
	category, err := s.FindOrCreateLoggedCategory(userID, workspaceName)
	if err != nil {
		return nil, err
	}

	result := &LogTasksResult{FailedIndices: []int{}}
	for i, content := range contents {
		now := time.Now()
		taskDoc := TaskDocument{
			ID:         primitive.NewObjectID(),
			Priority:   1,
			Content:    content,
			Value:      1,
			Active:     true,
			UserID:     userID,
			CategoryID: category.ID,
			StartDate:  &now,
			Timestamp:  now,
			LastEdited: now,
		}
		if _, err := s.CreateTask(category.ID, &taskDoc); err != nil {
			result.FailedIndices = append(result.FailedIndices, i)
			continue
		}
		completion, err := s.CompleteTask(userID, taskDoc.ID, category.ID, CompleteTaskDocument{
			TimeCompleted: now.Format(time.RFC3339),
			TimeTaken:     "PT0S",
		})
		if err != nil {
			result.FailedIndices = append(result.FailedIndices, i)
			continue
		}
		// CompleteTask only $merges into completed-tasks; the open copy is
		// removed separately, same as the CompleteTask handler does.
		if err := s.DeleteTask(category.ID, taskDoc.ID); err != nil {
			result.FailedIndices = append(result.FailedIndices, i)
			continue
		}
		result.TasksLogged++
		result.CurrentStreak = completion.CurrentStreak
	}
	return result, nil
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
go test ./internal/handlers/task/ -run TestLogService -v 2>&1 | tail -15
```

Expected: `PASS` on all three tests. If `types.CategoryDocument` decode fails on the upsert, check the bson field names against `backend/internal/handlers/types/types.go:17` (CategoryDocument).

- [ ] **Step 5: Commit**

```bash
cd /Users/abhik.ray/Kindred/.claude/worktrees/end-of-day-review-card
git add backend/internal/handlers/task/log_service.go backend/internal/handlers/task/log_service_test.go
git commit -m "feat(tasks): LogTasks service — create+complete entries in a per-workspace Logged category"
```

---

### Task 2: Backend — handler, Huma operation, route registration

**Files:**
- Create: `backend/internal/handlers/task/log_handlers.go`
- Modify: `backend/internal/handlers/task/routes.go` (add one line to `RegisterTaskOperations`)

- [ ] **Step 1: Write the handler and operation**

Create `backend/internal/handlers/task/log_handlers.go`:

```go
package task

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/abhikaboy/Kindred/internal/handlers/rings"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type LogTaskEntry struct {
	Content string `json:"content" example:"Went to the gym" doc:"What the user got done"`
}

type LogTasksInput struct {
	Authorization string `header:"Authorization" required:"true"`
	Body          struct {
		WorkspaceName string         `json:"workspaceName" example:"Personal" doc:"Workspace whose Logged category receives the tasks"`
		Tasks         []LogTaskEntry `json:"tasks" minItems:"1" maxItems:"50" doc:"Things the user did today"`
	} `json:"body"`
}

type LogTasksOutput struct {
	Body struct {
		Message       string `json:"message" example:"Tasks logged"`
		TasksLogged   int    `json:"tasksLogged" example:"3" doc:"Number of entries created and completed"`
		CurrentStreak int    `json:"currentStreak" example:"5" doc:"The user's current streak count"`
		FailedIndices []int  `json:"failedIndices,omitempty" doc:"Indices of entries that failed"`
	}
}

func (h *Handler) LogTasks(ctx context.Context, input *LogTasksInput) (*LogTasksOutput, error) {
	userIDStr, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Please log in to continue", err)
	}
	userObjID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}

	if strings.TrimSpace(input.Body.WorkspaceName) == "" {
		return nil, huma.Error400BadRequest("Workspace name is required", nil)
	}
	contents := make([]string, 0, len(input.Body.Tasks))
	for i, entry := range input.Body.Tasks {
		content := strings.TrimSpace(entry.Content)
		if content == "" {
			return nil, huma.Error400BadRequest(fmt.Sprintf("Entry %d is empty", i), nil)
		}
		contents = append(contents, content)
	}

	result, err := h.service.LogTasks(userObjID, input.Body.WorkspaceName, contents)
	if err != nil {
		slog.Error("Failed to log tasks", "userId", userObjID.Hex(), "count", len(contents), "error", err)
		return nil, huma.Error500InternalServerError("Unable to log tasks due to a server error. Please try again.", err)
	}

	// Fire-and-forget: each logged task counts as a creation (Plan) and a
	// completion (Do), matching the BulkCompleteTask pattern.
	if h.service.RingService != nil && result.TasksLogged > 0 {
		go func() {
			tz := auth.GetTimezoneOrDefault(ctx)
			for i := 0; i < result.TasksLogged; i++ {
				for _, ring := range []rings.RingType{rings.RingPlan, rings.RingDo} {
					_, delta, err := h.service.RingService.IncrementRing(context.Background(), userObjID, tz, ring)
					if err != nil {
						slog.Error("Failed to increment ring on task log", "user_id", userObjID.Hex(), "ring", ring, "error", err)
						return
					}
					if delta.JustClosedAll {
						h.service.RingService.NotifyAllRingsClosed(userObjID)
						return
					}
				}
			}
		}()
	}

	resp := &LogTasksOutput{}
	resp.Body.Message = "Tasks logged"
	resp.Body.TasksLogged = result.TasksLogged
	resp.Body.CurrentStreak = result.CurrentStreak
	if len(result.FailedIndices) > 0 {
		resp.Body.FailedIndices = result.FailedIndices
	}
	return resp, nil
}

func RegisterLogTasksOperation(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "log-tasks",
		Method:      http.MethodPost,
		Path:        "/v1/user/tasks/log",
		Summary:     "Log completed tasks",
		Description: "Create and immediately complete tasks in the workspace's Logged category. Used by the end-of-day review card for work that was done but never tracked.",
		Tags:        []string{"tasks"},
	}, handler.LogTasks)
}
```

Routing note: `/v1/user/tasks/log` overlaps the `POST /v1/user/tasks/{category}` pattern; the router gives static segments priority (same reason `/v1/user/tasks/bulk/complete` coexists with `/{category}/{id}`). Verified at runtime by Step 3.

- [ ] **Step 2: Register the operation**

In `backend/internal/handlers/task/routes.go`, inside `RegisterTaskOperations`, add after `RegisterBulkCompleteTaskOperation(api, handler)`:

```go
	RegisterLogTasksOperation(api, handler)
```

- [ ] **Step 3: Build, test, and regenerate the API spec**

```bash
cd /Users/abhik.ray/Kindred/.claude/worktrees/end-of-day-review-card/backend
go build ./... && go test ./internal/handlers/task/ -run TestLogService 2>&1 | tail -3
cd /Users/abhik.ray/Kindred/.claude/worktrees/end-of-day-review-card
make generate-api 2>&1 | tail -10
```

Expected: build OK, tests pass, and `make generate-api` completes WITHOUT a panic (a panic here means a Huma duplicate-type-name collision — rename the colliding `LogTasks*` type and re-run). It also regenerates `frontend/api/api-spec.yaml` + `frontend/api/generated/types.ts`; confirm with:

```bash
grep -n "tasks/log" frontend/api/generated/types.ts | head -3
```

Expected: at least one match (`"/v1/user/tasks/log"`).

- [ ] **Step 4: Commit**

```bash
git add backend/internal/handlers/task/log_handlers.go backend/internal/handlers/task/routes.go frontend/api/api-spec.yaml frontend/api/generated/types.ts
git commit -m "feat(tasks): POST /v1/user/tasks/log endpoint with Plan+Do ring credit"
```

---

### Task 3: Frontend — API wrappers

**Files:**
- Modify: `frontend/api/task.ts` (append near the other completion APIs)

- [ ] **Step 1: Add the wrappers**

Append to `frontend/api/task.ts` (after `markAsCompletedAPI` / near other completion helpers; reuse the existing `client` and `withAuthHeaders` imports already at the top of the file):

```ts
export interface LogTasksResult {
    message: string;
    tasksLogged: number;
    currentStreak: number;
    failedIndices?: number[];
}

/**
 * Log untracked work: creates + completes one task per entry in the
 * workspace's "Logged" category (end-of-day review card).
 */
export const logTasksAPI = async (workspaceName: string, contents: string[]): Promise<LogTasksResult> => {
    const { data, error } = await client.POST("/v1/user/tasks/log", {
        params: withAuthHeaders({}),
        body: { workspaceName, tasks: contents.map((content) => ({ content })) },
    });

    if (error) {
        throw new Error(`Failed to log tasks: ${JSON.stringify(error)}`);
    }

    return data as unknown as LogTasksResult;
};

export interface BulkCompleteItem {
    taskId: string;
    categoryId: string;
}

export interface BulkCompleteResult {
    message: string;
    totalCompleted: number;
    totalFailed: number;
    currentStreak: number;
    failedTaskIds?: string[];
}

/**
 * Complete several existing tasks in one request.
 */
export const bulkCompleteTasksAPI = async (items: BulkCompleteItem[]): Promise<BulkCompleteResult> => {
    const timeCompleted = new Date().toISOString();
    const { data, error } = await client.POST("/v1/user/tasks/bulk/complete", {
        params: withAuthHeaders({}),
        body: {
            tasks: items.map(({ taskId, categoryId }) => ({
                taskId,
                categoryId,
                completeData: { timeCompleted, timeTaken: "PT0S" },
            })),
        },
    });

    if (error) {
        throw new Error(`Failed to bulk complete tasks: ${JSON.stringify(error)}`);
    }

    return data as unknown as BulkCompleteResult;
};
```

If `withAuthHeaders({})` doesn't typecheck for an endpoint without path params, check how `frontend/api/utils.ts` defines it and follow whatever an existing no-path-param call does (e.g., search `client.POST` calls without `path:` in `frontend/api/`).

- [ ] **Step 2: Typecheck**

```bash
cd /Users/abhik.ray/Kindred/.claude/worktrees/end-of-day-review-card/frontend
bun run tsc --noEmit 2>&1 | grep -E "api/task" | head; echo "exit: $?"
```

Expected: no errors mentioning `api/task.ts` (the repo may have pre-existing errors elsewhere; only `api/task.ts` matters here). If the project has no `tsc` script, run `bun x tsc --noEmit` from `frontend/`.

- [ ] **Step 3: Commit**

```bash
git add frontend/api/task.ts
git commit -m "feat(api): logTasksAPI and bulkCompleteTasksAPI wrappers"
```

---

### Task 4: Frontend — pure end-of-day utils (TDD)

**Files:**
- Create: `frontend/utils/endOfDay.ts`
- Create: `frontend/__tests__/endOfDay.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/__tests__/endOfDay.test.ts`:

```ts
import { END_OF_DAY_HOUR, endOfDayDismissKey, isEndOfDayWindow, todaysOpenTasks } from "@/utils/endOfDay";
import { Task } from "@/api/types";

const task = (over: Partial<Task>): Task =>
    ({ id: "t", content: "", priority: 1, value: 1, categoryID: "cat-1", ...(over as any) }) as Task;

describe("isEndOfDayWindow", () => {
    it("is false before the trigger hour", () => {
        expect(isEndOfDayWindow(new Date(2026, 5, 10, END_OF_DAY_HOUR - 1, 59))).toBe(false);
    });

    it("is true from the trigger hour until midnight", () => {
        expect(isEndOfDayWindow(new Date(2026, 5, 10, END_OF_DAY_HOUR, 0))).toBe(true);
        expect(isEndOfDayWindow(new Date(2026, 5, 10, 23, 59))).toBe(true);
    });

    it("resets after midnight", () => {
        expect(isEndOfDayWindow(new Date(2026, 5, 11, 0, 1))).toBe(false);
    });
});

describe("endOfDayDismissKey", () => {
    it("encodes the local date", () => {
        expect(endOfDayDismissKey(new Date(2026, 5, 10, 21, 0))).toBe("eod-dismissed-2026-06-10");
    });

    it("differs across days so the card returns the next evening", () => {
        expect(endOfDayDismissKey(new Date(2026, 5, 10))).not.toBe(endOfDayDismissKey(new Date(2026, 5, 11)));
    });
});

describe("todaysOpenTasks", () => {
    const now = new Date(2026, 5, 10, 20, 30);

    it("includes tasks starting today, due today, and overdue", () => {
        const tasks = [
            task({ id: "starts-today", startDate: new Date(2026, 5, 10, 9).toISOString() }),
            task({ id: "due-today", deadline: new Date(2026, 5, 10, 22).toISOString() }),
            task({ id: "overdue", deadline: new Date(2026, 5, 8).toISOString() }),
            task({ id: "future", startDate: new Date(2026, 5, 12).toISOString() }),
        ];
        expect(todaysOpenTasks(tasks, now).map((t) => t.id)).toEqual(["starts-today", "due-today", "overdue"]);
    });

    it("dedupes a task that both starts and is due today", () => {
        const both = task({
            id: "both",
            startDate: new Date(2026, 5, 10, 9).toISOString(),
            deadline: new Date(2026, 5, 10, 22).toISOString(),
        });
        expect(todaysOpenTasks([both], now)).toHaveLength(1);
    });

    it("excludes synthetic upcoming categories (not real, not completable)", () => {
        const synthetic = task({
            id: "synth",
            categoryID: "upcoming-Personal",
            startDate: new Date(2026, 5, 10).toISOString(),
        });
        expect(todaysOpenTasks([synthetic], now)).toHaveLength(0);
    });
});

describe("runEndOfDaySubmission", () => {
    const checked = [
        task({ id: "t1", categoryID: "c1" }),
        task({ id: "t2", categoryID: "c2" }),
    ];

    it("bulk-completes checked tasks and logs entries with the right payloads", async () => {
        const bulkComplete = jest.fn().mockResolvedValue({ totalCompleted: 2, totalFailed: 0, failedTaskIds: [] });
        const logTasks = jest.fn().mockResolvedValue({ tasksLogged: 1, currentStreak: 3 });

        const result = await runEndOfDaySubmission(checked, ["gym"], "Personal", { bulkComplete, logTasks });

        expect(bulkComplete).toHaveBeenCalledWith([
            { taskId: "t1", categoryId: "c1" },
            { taskId: "t2", categoryId: "c2" },
        ]);
        expect(logTasks).toHaveBeenCalledWith("Personal", ["gym"]);
        expect(result).toEqual({
            completedCount: 2,
            loggedCount: 1,
            failedCount: 0,
            confirmedCompletions: [
                { taskId: "t1", categoryId: "c1" },
                { taskId: "t2", categoryId: "c2" },
            ],
            remainingEntries: [],
        });
    });

    it("keeps failed entries and excludes failed completions from confirmations", async () => {
        const bulkComplete = jest.fn().mockResolvedValue({ totalCompleted: 1, totalFailed: 1, failedTaskIds: ["t2"] });
        const logTasks = jest.fn().mockResolvedValue({ tasksLogged: 1, currentStreak: 3, failedIndices: [0] });

        const result = await runEndOfDaySubmission(checked, ["a", "b"], "Personal", { bulkComplete, logTasks });

        expect(result.confirmedCompletions).toEqual([{ taskId: "t1", categoryId: "c1" }]);
        expect(result.remainingEntries).toEqual(["a"]);
        expect(result.failedCount).toBe(2);
    });

    it("skips the APIs entirely for empty inputs", async () => {
        const bulkComplete = jest.fn();
        const logTasks = jest.fn();

        const result = await runEndOfDaySubmission([], [], "Personal", { bulkComplete, logTasks });

        expect(bulkComplete).not.toHaveBeenCalled();
        expect(logTasks).not.toHaveBeenCalled();
        expect(result.failedCount).toBe(0);
    });
});
```

(Also add `runEndOfDaySubmission` to the import list at the top of the test file.)

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/abhik.ray/Kindred/.claude/worktrees/end-of-day-review-card/frontend
bun run test endOfDay 2>&1 | tail -10
```

Expected: FAIL — cannot find module `@/utils/endOfDay`.

- [ ] **Step 3: Write the implementation**

Create `frontend/utils/endOfDay.ts`:

```ts
import { isSameDay, startOfDay } from "date-fns";
import type { Task } from "@/api/types";

export const END_OF_DAY_HOUR = 20;

export function isEndOfDayWindow(now: Date): boolean {
    return now.getHours() >= END_OF_DAY_HOUR;
}

export function endOfDayDismissKey(now: Date): string {
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `eod-dismissed-${now.getFullYear()}-${month}-${day}`;
}

// Open tasks worth reviewing tonight: starting today, due today, or overdue.
// Synthetic "Upcoming" categories aren't real categories and can't be completed.
export function todaysOpenTasks(allTasks: Task[], now: Date = new Date()): Task[] {
    const seen = new Set<string>();
    const result: Task[] = [];
    for (const t of allTasks) {
        if (!t.id || seen.has(t.id)) continue;
        if (t.categoryID?.startsWith("upcoming-")) continue;

        const startsToday = t.startDate ? isSameDay(new Date(t.startDate), now) : false;
        const dueToday = t.deadline ? isSameDay(new Date(t.deadline), now) : false;
        const overdue = t.deadline ? startOfDay(new Date(t.deadline)) < startOfDay(now) : false;

        if (startsToday || dueToday || overdue) {
            seen.add(t.id);
            result.push(t);
        }
    }
    return result;
}

export interface EndOfDaySubmissionDeps {
    bulkComplete: (items: { taskId: string; categoryId: string }[]) => Promise<BulkCompleteResult>;
    logTasks: (workspaceName: string, contents: string[]) => Promise<LogTasksResult>;
}

export interface EndOfDaySubmissionResult {
    completedCount: number;
    loggedCount: number;
    failedCount: number;
    confirmedCompletions: { taskId: string; categoryId: string }[];
    remainingEntries: string[];
}

// The sheet's submit step, kept pure (deps injected) so it's unit-testable
// without rendering the gorhom bottom sheet.
export async function runEndOfDaySubmission(
    checkedTasks: Task[],
    entries: string[],
    workspaceName: string | undefined,
    deps: EndOfDaySubmissionDeps
): Promise<EndOfDaySubmissionResult> {
    let completedCount = 0;
    let loggedCount = 0;
    let failedCount = 0;
    const confirmedCompletions: { taskId: string; categoryId: string }[] = [];
    // Entries are only cleared once the log call confirms them.
    let remainingEntries: string[] = entries;

    if (checkedTasks.length > 0) {
        const res = await deps.bulkComplete(
            checkedTasks.map((t) => ({ taskId: t.id, categoryId: t.categoryID! }))
        );
        const failed = new Set(res.failedTaskIds ?? []);
        for (const t of checkedTasks) {
            if (!failed.has(t.id)) confirmedCompletions.push({ taskId: t.id, categoryId: t.categoryID! });
        }
        completedCount = res.totalCompleted;
        failedCount += res.totalFailed;
    }

    if (entries.length > 0 && workspaceName) {
        const res = await deps.logTasks(workspaceName, entries);
        loggedCount = res.tasksLogged;
        const failedIdx = new Set(res.failedIndices ?? []);
        failedCount += failedIdx.size;
        remainingEntries = entries.filter((_, i) => failedIdx.has(i));
    }

    return { completedCount, loggedCount, failedCount, confirmedCompletions, remainingEntries };
}
```

Add to the imports at the top of `frontend/utils/endOfDay.ts`:

```ts
import type { BulkCompleteResult, LogTasksResult } from "@/api/task";
```

(Type-only import — no runtime cycle. Task 3 must be complete first, which it is in plan order.)

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run test endOfDay 2>&1 | tail -8
```

Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add frontend/utils/endOfDay.ts frontend/__tests__/endOfDay.test.ts
git commit -m "feat(eod): pure helpers for end-of-day window, dismissal key, and today's open tasks"
```

---

### Task 5: Frontend — `useEndOfDayCard` visibility hook

**Files:**
- Create: `frontend/hooks/useEndOfDayCard.ts`

- [ ] **Step 1: Write the hook**

Create `frontend/hooks/useEndOfDayCard.ts`:

```ts
import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { endOfDayDismissKey, isEndOfDayWindow } from "@/utils/endOfDay";

/**
 * Card is visible from END_OF_DAY_HOUR until local midnight, unless dismissed
 * (or the review was completed) today. Re-checks every minute so the card
 * appears if the app stays open across the trigger hour.
 */
export const useEndOfDayCard = () => {
    // Start hidden until storage answers, so the card never flashes.
    const [dismissedToday, setDismissedToday] = useState(true);
    const [inWindow, setInWindow] = useState(() => isEndOfDayWindow(new Date()));

    useEffect(() => {
        let cancelled = false;
        const check = async () => {
            const now = new Date();
            const stored = await AsyncStorage.getItem(endOfDayDismissKey(now));
            if (cancelled) return;
            setInWindow(isEndOfDayWindow(now));
            setDismissedToday(stored != null);
        };
        check();
        const interval = setInterval(check, 60_000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []);

    const dismiss = useCallback(() => {
        setDismissedToday(true);
        AsyncStorage.setItem(endOfDayDismissKey(new Date()), "1").catch(() => {});
    }, []);

    return { visible: inWindow && !dismissedToday, dismiss };
};
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/abhik.ray/Kindred/.claude/worktrees/end-of-day-review-card/frontend
bun x tsc --noEmit 2>&1 | grep "useEndOfDayCard" | head; echo "checked"
```

Expected: no output before "checked".

- [ ] **Step 3: Commit**

```bash
git add frontend/hooks/useEndOfDayCard.ts
git commit -m "feat(eod): useEndOfDayCard visibility hook with per-day AsyncStorage dismissal"
```

---

### Task 6: Frontend — `EndOfDayReviewSheet` bottom sheet

**Files:**
- Create: `frontend/components/modals/EndOfDayReviewSheet.tsx`

- [ ] **Step 1: Write the sheet component**

Create `frontend/components/modals/EndOfDayReviewSheet.tsx`. Design constraints from project memory: ThemedText semantic types only (no hardcoded fontFamily), Phosphor icons, left-aligned, no "streak" wording in copy, no render-helper functions (rows are real components).

```tsx
import React, { useState } from "react";
import { StyleSheet, TextInput, TouchableOpacity, View, ScrollView } from "react-native";
import { CheckCircleIcon, CircleIcon, PlusCircleIcon, XCircleIcon } from "phosphor-react-native";
import { useQueryClient } from "@tanstack/react-query";
import DefaultModal from "./DefaultModal";
import { ThemedText } from "@/components/ThemedText";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTasks } from "@/contexts/tasksContext";
import { bulkCompleteTasksAPI, logTasksAPI } from "@/api/task";
import { runEndOfDaySubmission } from "@/utils/endOfDay";
import { showToast } from "@/utils/showToast";
import type { Task } from "@/api/types";

interface OpenTaskRowProps {
    task: Task;
    checked: boolean;
    onToggle: () => void;
}

function OpenTaskRow({ task, checked, onToggle }: OpenTaskRowProps) {
    const ThemedColor = useThemeColor();
    return (
        <TouchableOpacity style={styles.row} onPress={onToggle} activeOpacity={0.7}>
            {checked ? (
                <CheckCircleIcon size={24} weight="fill" color={ThemedColor.primary} />
            ) : (
                <CircleIcon size={24} color={ThemedColor.caption} />
            )}
            <View style={styles.rowText}>
                <ThemedText type="default" numberOfLines={1}>
                    {task.content}
                </ThemedText>
                {task.categoryName ? (
                    <ThemedText type="caption" style={{ color: ThemedColor.caption }}>
                        {task.categoryName}
                    </ThemedText>
                ) : null}
            </View>
        </TouchableOpacity>
    );
}

interface PendingEntryRowProps {
    content: string;
    onRemove: () => void;
}

function PendingEntryRow({ content, onRemove }: PendingEntryRowProps) {
    const ThemedColor = useThemeColor();
    return (
        <View style={styles.row}>
            <CheckCircleIcon size={24} weight="fill" color={ThemedColor.success ?? ThemedColor.primary} />
            <View style={styles.rowText}>
                <ThemedText type="default" numberOfLines={1}>
                    {content}
                </ThemedText>
            </View>
            <TouchableOpacity onPress={onRemove} hitSlop={8}>
                <XCircleIcon size={22} color={ThemedColor.caption} />
            </TouchableOpacity>
        </View>
    );
}

interface Props {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    openTasks: Task[];
    onLogged: () => void;
}

export default function EndOfDayReviewSheet({ visible, setVisible, openTasks, onLogged }: Props) {
    const ThemedColor = useThemeColor();
    const queryClient = useQueryClient();
    const { workspaces, selected, removeFromCategory, fetchWorkspaces } = useTasks();

    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
    const [entries, setEntries] = useState<string[]>([]);
    const [draft, setDraft] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const workspaceName = selected || workspaces.find((ws) => !ws.isBlueprint)?.name || workspaces[0]?.name;

    const toggleTask = (taskId: string) => {
        setCheckedIds((prev) => {
            const next = new Set(prev);
            if (next.has(taskId)) next.delete(taskId);
            else next.add(taskId);
            return next;
        });
    };

    const addEntry = () => {
        const content = draft.trim();
        if (!content) return;
        setEntries((prev) => [...prev, content]);
        setDraft("");
    };

    const removeEntry = (index: number) => {
        setEntries((prev) => prev.filter((_, i) => i !== index));
    };

    const canSubmit = !submitting && (checkedIds.size > 0 || entries.length > 0 || draft.trim().length > 0);

    const handleSubmit = async () => {
        // Pull in an un-added draft so "type and hit Log" works without tapping +.
        const pendingEntries = draft.trim() ? [...entries, draft.trim()] : entries;
        const checkedTasks = openTasks.filter((t) => t.id && checkedIds.has(t.id));

        setSubmitting(true);
        try {
            const result = await runEndOfDaySubmission(checkedTasks, pendingEntries, workspaceName, {
                bulkComplete: bulkCompleteTasksAPI,
                logTasks: logTasksAPI,
            });

            result.confirmedCompletions.forEach(({ taskId, categoryId }) => removeFromCategory(categoryId, taskId));
            setEntries(result.remainingEntries);
            setDraft("");
            if (result.loggedCount > 0) fetchWorkspaces(true);
            queryClient.invalidateQueries({ queryKey: ["rings", "today"] });

            const total = result.completedCount + result.loggedCount;
            if (result.failedCount > 0) {
                showToast(`${total} logged, ${result.failedCount} failed — try those again`, "warning");
            } else {
                showToast(`Nice — ${total} task${total === 1 ? "" : "s"} logged for today`, "success");
                onLogged();
                setVisible(false);
            }
        } catch (error) {
            console.error("End of day review failed:", error);
            showToast("Couldn't log your day. Please try again.", "danger");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <DefaultModal visible={visible} setVisible={setVisible}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <ThemedText type="fancyFrauncesHeading" style={styles.heading}>
                    How did today go?
                </ThemedText>

                {openTasks.length > 0 && (
                    <View style={styles.section}>
                        <ThemedText type="defaultSemiBold">Did you finish these?</ThemedText>
                        {openTasks.map((t) => (
                            <OpenTaskRow
                                key={t.id}
                                task={t}
                                checked={checkedIds.has(t.id)}
                                onToggle={() => toggleTask(t.id)}
                            />
                        ))}
                    </View>
                )}

                <View style={styles.section}>
                    <ThemedText type="defaultSemiBold">Anything else you got done?</ThemedText>
                    {entries.map((content, index) => (
                        <PendingEntryRow key={`${content}-${index}`} content={content} onRemove={() => removeEntry(index)} />
                    ))}
                    <View style={styles.inputRow}>
                        <TextInput
                            style={[styles.input, { color: ThemedColor.text, borderColor: ThemedColor.tertiary }]}
                            placeholder="e.g. went to the gym"
                            placeholderTextColor={ThemedColor.caption}
                            value={draft}
                            onChangeText={setDraft}
                            onSubmitEditing={addEntry}
                            returnKeyType="done"
                            submitBehavior="submit"
                        />
                        <TouchableOpacity onPress={addEntry} hitSlop={8}>
                            <PlusCircleIcon size={28} color={ThemedColor.primary} />
                        </TouchableOpacity>
                    </View>
                </View>

                <PrimaryButton title={submitting ? "Logging…" : "Log my day"} onPress={handleSubmit} disabled={!canSubmit} />
            </ScrollView>
        </DefaultModal>
    );
}

const styles = StyleSheet.create({
    heading: {
        marginBottom: 16,
    },
    section: {
        marginBottom: 24,
        gap: 8,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 8,
    },
    rowText: {
        flex: 1,
        gap: 2,
    },
    inputRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginTop: 4,
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontFamily: "Outfit",
        fontSize: 16,
    },
});
```

Adaptation notes for the implementer:
- Check `ThemedColor` actually has `success`; if not, use `ThemedColor.primary` (the `?? ` fallback already handles it, but remove the dead reference if the type errors).
- Check Phosphor icon names compile (`CheckCircleIcon`, `CircleIcon`, `PlusCircleIcon`, `XCircleIcon` from `phosphor-react-native`); the codebase already imports `HeartStraightIcon` in feed.tsx, so the `*Icon` naming is right.
- Check `showToast`'s accepted statuses (`grep -rn "showToast(" frontend/ | head`); if `"warning"` isn't supported, use `"info"` or `"danger"`.
- If `TextInput`'s `submitBehavior` prop isn't in this RN version, use `blurOnSubmit={false}`.

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/abhik.ray/Kindred/.claude/worktrees/end-of-day-review-card/frontend
bun x tsc --noEmit 2>&1 | grep "EndOfDayReviewSheet" | head; echo "checked"
```

Expected: no output before "checked".

- [ ] **Step 3: Commit**

```bash
git add frontend/components/modals/EndOfDayReviewSheet.tsx
git commit -m "feat(eod): EndOfDayReviewSheet — bulk check-off plus quick-log entries"
```

---

### Task 7: Frontend — `EndOfDayCard` + feed wiring

**Files:**
- Create: `frontend/components/cards/EndOfDayCard.tsx`
- Modify: `frontend/app/(logged-in)/(tabs)/(feed)/feed.tsx` (import + one element in `renderHeader`)

- [ ] **Step 1: Write the card**

Create `frontend/components/cards/EndOfDayCard.tsx`. The card self-manages visibility (renders `null` outside the window or once dismissed), so the feed only mounts it unconditionally.

```tsx
import React, { useMemo, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { MoonStarsIcon, XIcon } from "phosphor-react-native";
import { ThemedText } from "@/components/ThemedText";
import PrimaryButton from "@/components/inputs/PrimaryButton";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTasks } from "@/contexts/tasksContext";
import { useEndOfDayCard } from "@/hooks/useEndOfDayCard";
import { todaysOpenTasks } from "@/utils/endOfDay";
import EndOfDayReviewSheet from "@/components/modals/EndOfDayReviewSheet";

export default function EndOfDayCard() {
    const { visible, dismiss } = useEndOfDayCard();
    const { allTasks } = useTasks();
    const [sheetVisible, setSheetVisible] = useState(false);
    const ThemedColor = useThemeColor();

    const openTasks = useMemo(() => todaysOpenTasks(allTasks), [allTasks]);

    if (!visible) return null;

    const subtitle =
        openTasks.length > 0
            ? `You have ${openTasks.length} open task${openTasks.length === 1 ? "" : "s"} from today — check off what you finished and add anything else you got done.`
            : "Add anything you got done today, even if you never tracked it.";

    return (
        <View style={[styles.card, { backgroundColor: ThemedColor.lightenedCard, borderColor: ThemedColor.tertiary }]}>
            <View style={styles.headerRow}>
                <MoonStarsIcon size={24} weight="duotone" color={ThemedColor.primary} />
                <TouchableOpacity onPress={dismiss} hitSlop={8}>
                    <XIcon size={20} color={ThemedColor.caption} />
                </TouchableOpacity>
            </View>
            <ThemedText type="fancyFrauncesHeading">How did today go?</ThemedText>
            <ThemedText type="lightBody" style={{ color: ThemedColor.caption }}>
                {subtitle}
            </ThemedText>
            <PrimaryButton title="Log my day" onPress={() => setSheetVisible(true)} />
            <EndOfDayReviewSheet
                visible={sheetVisible}
                setVisible={setSheetVisible}
                openTasks={openTasks}
                onLogged={dismiss}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        marginHorizontal: 16,
        marginTop: 16,
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        gap: 12,
        alignItems: "flex-start",
    },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignSelf: "stretch",
        alignItems: "center",
    },
});
```

Adaptation notes: verify `ThemedColor.lightenedCard` exists (it's used in `CompletedTasksBottomSheetModal`); verify `MoonStarsIcon` exists in phosphor-react-native (fallback: `MoonIcon`). Check `ThemedText` `type="fancyFrauncesHeading"` renders at a sensible card size — if it's too large, use `type="subtitle"`... but prefer the Fraunces semantic type per design preferences.

- [ ] **Step 2: Wire into the feed header**

In `frontend/app/(logged-in)/(tabs)/(feed)/feed.tsx`:

Add the import with the other card imports (near `import RingsClosedFeedCard ...`):

```tsx
import EndOfDayCard from "@/components/cards/EndOfDayCard";
```

In `renderHeader` (the `ListHeaderComponent`), add `<EndOfDayCard />` as the last child of the `listHeader` View, after the closing `</View>` of `feedTabsContainer`:

```tsx
    const renderHeader = useCallback(() => {
        return (
            <View style={styles.listHeader}>
                <View style={styles.headerContainer}>
                    {/* ...unchanged... */}
                </View>

                <View style={styles.feedTabsContainer}>
                    {/* ...unchanged... */}
                </View>

                <EndOfDayCard />
            </View>
        );
    }, [ThemedColor.text, router, availableFeeds, renderFeedTab]);
```

(Only the `<EndOfDayCard />` line is new; the card pins to the top of the feed because the header renders above all feed items. No `FeedItem` type, keyExtractor, or data changes needed. The card has `marginTop`; if it visually collides with the header's bottom border, add `paddingBottom: 16` to the card's wrapper via the existing `listHeader` style — implementer's judgment, keep it left-aligned.)

- [ ] **Step 3: Verify compile + full frontend test suite**

```bash
cd /Users/abhik.ray/Kindred/.claude/worktrees/end-of-day-review-card/frontend
bun x tsc --noEmit 2>&1 | grep -E "EndOfDayCard|feed.tsx" | head; echo "checked"
bun run test 2>&1 | tail -6
```

Expected: no new type errors; test summary shows the SAME 4 pre-existing failing suites only (AboutScreen, dragHitTest, KudosItem, UserInfoEncouragementNotification) and `endOfDay.test.ts` passing.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/cards/EndOfDayCard.tsx "frontend/app/(logged-in)/(tabs)/(feed)/feed.tsx"
git commit -m "feat(eod): end-of-day review card pinned to feed header after 8pm"
```

---

### Task 8: Full verification

- [ ] **Step 1: Backend full test run**

```bash
cd /Users/abhik.ray/Kindred/.claude/worktrees/end-of-day-review-card/backend
go build ./... && go vet ./internal/handlers/task/ && go test ./internal/handlers/task/ 2>&1 | tail -3
```

Expected: build + vet clean, `ok ... internal/handlers/task`.

- [ ] **Step 2: Frontend full test run + lint**

```bash
cd /Users/abhik.ray/Kindred/.claude/worktrees/end-of-day-review-card/frontend
bun run test 2>&1 | grep -E "^(Tests|Test Suites):"
bun run lint 2>&1 | tail -5
```

Expected: exactly 4 failing suites (the pre-existing baseline), everything else passing including `endOfDay.test.ts`; lint introduces no new errors on the new files.

- [ ] **Step 3: Re-verify generated API artifacts are committed**

```bash
cd /Users/abhik.ray/Kindred/.claude/worktrees/end-of-day-review-card
git status --short
```

Expected: clean tree. If `frontend/api/api-spec.yaml` or `generated/types.ts` show as modified, `make generate-api` produced drift — commit it with `chore: regenerate api types`.

- [ ] **Step 4: Final commit check**

```bash
git log --oneline origin/main..HEAD
```

Expected: the spec/plan docs commits plus one commit per task above.
