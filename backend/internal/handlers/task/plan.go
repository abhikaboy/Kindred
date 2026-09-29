package task

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/xutils"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Grace for tasks that slipped past their day. A task can get a small plan
// (one step, a size and a time), be parked, or be released: a recoverable
// archive that hides it everywhere until the user brings it back. None of this
// is gated on AI credits.

const (
	planMaxSteps      = 6
	bulkReleaseMaxLen = 200
)

type TaskPlan = types.TaskPlan

// --- Service ---

// loadOwnedTask returns one task from a category the user owns, released or not.
func (s *Service) loadOwnedTask(ctx context.Context, userID, categoryID, taskID primitive.ObjectID) (*TaskDocument, error) {
	var cat struct {
		Tasks []TaskDocument `bson:"tasks"`
	}
	err := s.Tasks.FindOne(ctx,
		bson.M{"_id": categoryID, "user": userID, "tasks._id": taskID},
		options.FindOne().SetProjection(bson.M{"tasks.$": 1}),
	).Decode(&cat)
	if errors.Is(err, mongo.ErrNoDocuments) || (err == nil && len(cat.Tasks) == 0) {
		return nil, ErrTaskNotFound
	}
	if err != nil {
		return nil, err
	}
	return &cat.Tasks[0], nil
}

// updateOwnedTask applies a $set/$unset to one task the user owns.
func (s *Service) updateOwnedTask(ctx context.Context, userID, categoryID, taskID primitive.ObjectID, update bson.M) error {
	res, err := s.Tasks.UpdateOne(ctx,
		bson.M{"_id": categoryID, "user": userID, "tasks._id": taskID},
		update,
		getTaskArrayFilterOptions(taskID),
	)
	if err != nil {
		return err
	}
	if res.MatchedCount == 0 {
		return ErrTaskNotFound
	}
	return nil
}

// withoutPlanReminders drops any unsent plan reminder so a task carries at most one.
func withoutPlanReminders(reminders []*Reminder) []*Reminder {
	out := make([]*Reminder, 0, len(reminders))
	for _, r := range reminders {
		if r != nil && r.Type == PlanReminderType && !r.Sent {
			continue
		}
		out = append(out, r)
	}
	return out
}

// appendPlanSteps adds the plan step and any extra breakdown steps to the end
// of the checklist, skipping ones already on it.
func appendPlanSteps(checklist []ChecklistItem, step string, extra []string) []ChecklistItem {
	seen := map[string]bool{}
	order := 0
	for _, c := range checklist {
		seen[strings.ToLower(strings.TrimSpace(c.Content))] = true
		if c.Order >= order {
			order = c.Order + 1
		}
	}
	out := append([]ChecklistItem{}, checklist...)
	for _, raw := range append([]string{step}, extra...) {
		content := strings.TrimSpace(raw)
		key := strings.ToLower(content)
		if content == "" || seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, ChecklistItem{Content: content, Order: order})
		order++
	}
	return out
}

// SetTaskPlan commits a plan: the task moves to the plan's time, gets exactly
// one "Try: <step>" reminder there, and optionally gains breakdown steps.
func (s *Service) SetTaskPlan(ctx context.Context, userID, categoryID, taskID primitive.ObjectID, body SetTaskPlanBody) (*TaskDocument, error) {
	current, err := s.loadOwnedTask(ctx, userID, categoryID, taskID)
	if err != nil {
		return nil, err
	}

	now := xutils.NowUTC()
	at := body.At.UTC()
	step := strings.TrimSpace(body.Step)
	plan := TaskPlan{Step: step, Size: body.Size, At: at, CommittedAt: now}
	if current.Plan != nil {
		plan.Replans = current.Plan.Replans + 1
	}

	copyText := PlanReminderCopy(step)
	reminders := append(withoutPlanReminders(current.Reminders), &Reminder{
		TriggerTime:   at,
		Type:          PlanReminderType,
		CustomMessage: &copyText,
	})

	set := bson.M{
		"tasks.$[t].plan":       plan,
		"tasks.$[t].startDate":  at,
		"tasks.$[t].startTime":  at,
		"tasks.$[t].reminders":  reminders,
		"tasks.$[t].lastEdited": now,
	}
	if len(body.Steps) > 0 {
		set["tasks.$[t].checklist"] = appendPlanSteps(current.Checklist, step, body.Steps)
	}
	update := bson.M{"$set": set}
	if inc := s.rescheduleInc(ctx, taskID, categoryID, &at, nil); inc != nil {
		update["$inc"] = inc
	}
	if err := s.updateOwnedTask(ctx, userID, categoryID, taskID, update); err != nil {
		return nil, err
	}
	return s.loadOwnedTask(ctx, userID, categoryID, taskID)
}

// ClearTaskPlan removes the plan and its pending reminder. The task keeps the
// time the plan moved it to.
func (s *Service) ClearTaskPlan(ctx context.Context, userID, categoryID, taskID primitive.ObjectID) (*TaskDocument, error) {
	current, err := s.loadOwnedTask(ctx, userID, categoryID, taskID)
	if err != nil {
		return nil, err
	}
	update := bson.M{
		"$set": bson.M{
			"tasks.$[t].reminders":  withoutPlanReminders(current.Reminders),
			"tasks.$[t].lastEdited": xutils.NowUTC(),
		},
		"$unset": bson.M{"tasks.$[t].plan": ""},
	}
	if err := s.updateOwnedTask(ctx, userID, categoryID, taskID, update); err != nil {
		return nil, err
	}
	return s.loadOwnedTask(ctx, userID, categoryID, taskID)
}

// SetTaskParked parks (true) or unparks (false) a task.
func (s *Service) SetTaskParked(ctx context.Context, userID, categoryID, taskID primitive.ObjectID, parked bool) error {
	return s.setTaskTimestampField(ctx, userID, categoryID, taskID, "parkedAt", parked)
}

// SetTaskReleased releases (true) or restores (false) a task.
func (s *Service) SetTaskReleased(ctx context.Context, userID, categoryID, taskID primitive.ObjectID, released bool) error {
	if err := s.setTaskTimestampField(ctx, userID, categoryID, taskID, "releasedAt", released); err != nil {
		return err
	}
	if !released {
		s.settleStaleReminders(ctx, categoryID, []primitive.ObjectID{taskID})
	}
	return nil
}

func (s *Service) setTaskTimestampField(ctx context.Context, userID, categoryID, taskID primitive.ObjectID, field string, on bool) error {
	now := xutils.NowUTC()
	set := bson.M{"tasks.$[t].lastEdited": now}
	update := bson.M{"$set": set}
	if on {
		set["tasks.$[t]."+field] = now
	} else {
		update["$unset"] = bson.M{"tasks.$[t]." + field: ""}
	}
	return s.updateOwnedTask(ctx, userID, categoryID, taskID, update)
}

// settleStaleReminders marks reminders that came due while a task was
// released as sent, so restoring it doesn't fire a burst of old nudges.
func (s *Service) settleStaleReminders(ctx context.Context, categoryID primitive.ObjectID, taskIDs []primitive.ObjectID) {
	_, err := s.Tasks.UpdateOne(ctx,
		bson.M{"_id": categoryID},
		bson.M{"$set": bson.M{"tasks.$[t].reminders.$[r].sent": true}},
		options.Update().SetArrayFilters(options.ArrayFilters{Filters: bson.A{
			bson.M{"t._id": bson.M{"$in": taskIDs}},
			bson.M{"r.sent": false, "r.triggerTime": bson.M{"$lte": xutils.NowUTC()}},
		}}),
	)
	if err != nil {
		slog.Warn("Failed to settle reminders on restored task", "categoryId", categoryID.Hex(), "error", err)
	}
}

// BulkReleaseTasks releases many tasks at once, one update per category.
// Returns how many tasks were released; items outside the user's categories
// are skipped.
func (s *Service) BulkReleaseTasks(ctx context.Context, userID primitive.ObjectID, items []ReleaseTaskItem) (int, []string, error) {
	byCategory := map[primitive.ObjectID][]primitive.ObjectID{}
	var failed []string
	for _, it := range items {
		taskID, err1 := primitive.ObjectIDFromHex(it.TaskID)
		catID, err2 := primitive.ObjectIDFromHex(it.CategoryID)
		if err1 != nil || err2 != nil {
			failed = append(failed, it.TaskID)
			continue
		}
		byCategory[catID] = append(byCategory[catID], taskID)
	}

	now := xutils.NowUTC()
	released := 0
	for catID, taskIDs := range byCategory {
		var cat struct {
			Tasks []struct {
				ID         primitive.ObjectID `bson:"_id"`
				ReleasedAt *time.Time         `bson:"releasedAt"`
			} `bson:"tasks"`
		}
		err := s.Tasks.FindOne(ctx, bson.M{"_id": catID, "user": userID},
			options.FindOne().SetProjection(bson.M{"tasks._id": 1, "tasks.releasedAt": 1})).Decode(&cat)
		if err != nil && !errors.Is(err, mongo.ErrNoDocuments) {
			return released, failed, err
		}
		present := map[primitive.ObjectID]bool{}
		for _, t := range cat.Tasks {
			if t.ReleasedAt == nil {
				present[t.ID] = true
			}
		}
		var targets []primitive.ObjectID
		for _, id := range taskIDs {
			if present[id] {
				targets = append(targets, id)
			} else {
				failed = append(failed, id.Hex())
			}
		}
		if len(targets) == 0 {
			continue
		}
		_, err = s.Tasks.UpdateOne(ctx,
			bson.M{"_id": catID, "user": userID},
			bson.M{"$set": bson.M{"tasks.$[t].releasedAt": now, "tasks.$[t].lastEdited": now}},
			options.Update().SetArrayFilters(options.ArrayFilters{Filters: bson.A{
				bson.M{"t._id": bson.M{"$in": targets}},
			}}),
		)
		if err != nil {
			return released, failed, err
		}
		released += len(targets)
	}
	return released, failed, nil
}

// GetReleasedTasks lists the user's released tasks, most recent first.
func (s *Service) GetReleasedTasks(ctx context.Context, userID primitive.ObjectID) ([]TaskDocument, error) {
	cursor, err := s.Tasks.Aggregate(ctx, mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"user": userID}}},
		{{Key: "$unwind", Value: "$tasks"}},
		{{Key: "$match", Value: bson.M{"tasks.releasedAt": bson.M{"$ne": nil}}}},
		{{Key: "$set", Value: bson.M{"tasks.userID": "$user", "tasks.categoryID": "$_id"}}},
		{{Key: "$replaceRoot", Value: bson.M{"newRoot": "$tasks"}}},
		{{Key: "$sort", Value: bson.D{{Key: "releasedAt", Value: -1}}}},
	})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	out := []TaskDocument{}
	if err := cursor.All(ctx, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// --- Breakdown suggestions ---

// breakdownDraft mirrors gemini.SuggestBreakdownFlowOutput.
type breakdownDraft struct {
	Steps    []string `json:"steps"`
	WhenHint string   `json:"whenHint,omitempty"`
}

// CleanBreakdownSteps keeps 2-4 short, distinct, non-empty steps.
func CleanBreakdownSteps(steps []string) []string {
	out := []string{}
	seen := map[string]bool{}
	for _, raw := range steps {
		st := strings.TrimSpace(strings.TrimRight(strings.TrimSpace(raw), "."))
		key := strings.ToLower(st)
		if st == "" || seen[key] || len(strings.Fields(st)) > 12 {
			continue
		}
		seen[key] = true
		out = append(out, st)
		if len(out) == 4 {
			break
		}
	}
	return out
}

// --- Operations ---

type SetTaskPlanBody struct {
	Step  string    `json:"step" minLength:"1" maxLength:"200" doc:"The first small step to try"`
	Size  string    `json:"size" enum:"2m,10m,full" doc:"How long the step takes"`
	At    time.Time `json:"at" doc:"When to try it; the task's start moves here"`
	Steps []string  `json:"steps,omitempty" maxItems:"6" doc:"Extra breakdown steps to append to the checklist after the plan step"`
}

type SetTaskPlanInput struct {
	Authorization string          `header:"Authorization" required:"true"`
	Category      string          `path:"category" example:"507f1f77bcf86cd799439011"`
	ID            string          `path:"id" example:"507f1f77bcf86cd799439011"`
	Body          SetTaskPlanBody `json:"body"`
}

type TaskPathInput struct {
	Authorization string `header:"Authorization" required:"true"`
	Category      string `path:"category" example:"507f1f77bcf86cd799439011"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
}

type TaskPlanOutput struct {
	Body TaskDocument
}

type TaskGraceOutput struct {
	Body struct {
		Message string `json:"message" example:"Task updated"`
	}
}

type ReleaseTaskItem struct {
	TaskID     string `json:"taskId" example:"507f1f77bcf86cd799439011"`
	CategoryID string `json:"categoryId" example:"507f1f77bcf86cd799439011"`
}

type BulkReleaseTasksInput struct {
	Authorization string `header:"Authorization" required:"true"`
	Body          struct {
		Tasks []ReleaseTaskItem `json:"tasks" minItems:"1" maxItems:"200"`
	}
}

type BulkReleaseTasksOutput struct {
	Body struct {
		Released      int      `json:"released" doc:"How many tasks were released"`
		FailedTaskIDs []string `json:"failedTaskIds" doc:"Tasks that were not found or already released"`
	}
}

type GetReleasedTasksInput struct {
	Authorization string `header:"Authorization" required:"true"`
}

type GetReleasedTasksOutput struct {
	Body struct {
		Tasks []TaskDocument `json:"tasks"`
	}
}

type BreakdownSuggestionsInput struct {
	Authorization string `header:"Authorization" required:"true"`
	Category      string `path:"category" example:"507f1f77bcf86cd799439011"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
	Body          struct {
		Size string `json:"size" enum:"2m,10m,full" doc:"How much time the user has for the first step"`
	}
}

type BreakdownSuggestionsOutput struct {
	Body struct {
		Steps    []string `json:"steps" doc:"2-4 small first steps; empty when none could be suggested"`
		WhenHint string   `json:"whenHint,omitempty" doc:"Optional one-line hint about a good time to try"`
	}
}

// --- Handlers ---

func resolveTaskPath(ctx context.Context, category, id string) (userID, categoryID, taskID primitive.ObjectID, err error) {
	uid, err := auth.RequireAuth(ctx)
	if err != nil {
		return userID, categoryID, taskID, huma.Error401Unauthorized("Please log in to continue", err)
	}
	if userID, err = primitive.ObjectIDFromHex(uid); err != nil {
		return userID, categoryID, taskID, huma.Error400BadRequest("Invalid user ID format", err)
	}
	if categoryID, err = primitive.ObjectIDFromHex(category); err != nil {
		return userID, categoryID, taskID, huma.Error400BadRequest("Invalid category ID format", err)
	}
	if taskID, err = primitive.ObjectIDFromHex(id); err != nil {
		return userID, categoryID, taskID, huma.Error400BadRequest("Invalid task ID format", err)
	}
	return userID, categoryID, taskID, nil
}

func graceError(err error, action string) error {
	if errors.Is(err, ErrTaskNotFound) {
		return huma.Error404NotFound("Task not found", err)
	}
	return huma.Error500InternalServerError("Unable to "+action+". Please try again.", err)
}

func (h *Handler) SetTaskPlan(ctx context.Context, input *SetTaskPlanInput) (*TaskPlanOutput, error) {
	userID, categoryID, taskID, err := resolveTaskPath(ctx, input.Category, input.ID)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(input.Body.Step) == "" || !types.ValidPlanSize(input.Body.Size) || input.Body.At.IsZero() {
		return nil, huma.Error400BadRequest("A plan needs a step, a size and a time", nil)
	}
	if len(input.Body.Steps) > planMaxSteps {
		input.Body.Steps = input.Body.Steps[:planMaxSteps]
	}
	task, err := h.service.SetTaskPlan(ctx, userID, categoryID, taskID, input.Body)
	if err != nil {
		slog.Error("Failed to set task plan", "taskId", taskID.Hex(), "error", err)
		return nil, graceError(err, "save the plan")
	}
	return &TaskPlanOutput{Body: *task}, nil
}

func (h *Handler) ClearTaskPlan(ctx context.Context, input *TaskPathInput) (*TaskPlanOutput, error) {
	userID, categoryID, taskID, err := resolveTaskPath(ctx, input.Category, input.ID)
	if err != nil {
		return nil, err
	}
	task, err := h.service.ClearTaskPlan(ctx, userID, categoryID, taskID)
	if err != nil {
		slog.Error("Failed to clear task plan", "taskId", taskID.Hex(), "error", err)
		return nil, graceError(err, "clear the plan")
	}
	return &TaskPlanOutput{Body: *task}, nil
}

func (h *Handler) graceToggle(ctx context.Context, input *TaskPathInput, action string, apply func(context.Context, primitive.ObjectID, primitive.ObjectID, primitive.ObjectID) error) (*TaskGraceOutput, error) {
	userID, categoryID, taskID, err := resolveTaskPath(ctx, input.Category, input.ID)
	if err != nil {
		return nil, err
	}
	if err := apply(ctx, userID, categoryID, taskID); err != nil {
		slog.Error("Failed to "+action+" task", "taskId", taskID.Hex(), "error", err)
		return nil, graceError(err, action+" the task")
	}
	out := &TaskGraceOutput{}
	out.Body.Message = "Task updated"
	return out, nil
}

func (h *Handler) ParkTask(ctx context.Context, input *TaskPathInput) (*TaskGraceOutput, error) {
	return h.graceToggle(ctx, input, "park", func(ctx context.Context, u, c, t primitive.ObjectID) error {
		return h.service.SetTaskParked(ctx, u, c, t, true)
	})
}

func (h *Handler) UnparkTask(ctx context.Context, input *TaskPathInput) (*TaskGraceOutput, error) {
	return h.graceToggle(ctx, input, "unpark", func(ctx context.Context, u, c, t primitive.ObjectID) error {
		return h.service.SetTaskParked(ctx, u, c, t, false)
	})
}

func (h *Handler) ReleaseTask(ctx context.Context, input *TaskPathInput) (*TaskGraceOutput, error) {
	return h.graceToggle(ctx, input, "release", func(ctx context.Context, u, c, t primitive.ObjectID) error {
		return h.service.SetTaskReleased(ctx, u, c, t, true)
	})
}

func (h *Handler) UnreleaseTask(ctx context.Context, input *TaskPathInput) (*TaskGraceOutput, error) {
	return h.graceToggle(ctx, input, "restore", func(ctx context.Context, u, c, t primitive.ObjectID) error {
		return h.service.SetTaskReleased(ctx, u, c, t, false)
	})
}

func (h *Handler) BulkReleaseTasks(ctx context.Context, input *BulkReleaseTasksInput) (*BulkReleaseTasksOutput, error) {
	uid, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Please log in to continue", err)
	}
	userID, err := primitive.ObjectIDFromHex(uid)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}
	items := input.Body.Tasks
	if len(items) > bulkReleaseMaxLen {
		items = items[:bulkReleaseMaxLen]
	}
	released, failed, err := h.service.BulkReleaseTasks(ctx, userID, items)
	if err != nil {
		slog.Error("Failed to bulk release tasks", "userId", uid, "error", err)
		return nil, huma.Error500InternalServerError("Unable to clear these tasks. Please try again.", err)
	}
	out := &BulkReleaseTasksOutput{}
	out.Body.Released = released
	out.Body.FailedTaskIDs = failed
	if out.Body.FailedTaskIDs == nil {
		out.Body.FailedTaskIDs = []string{}
	}
	return out, nil
}

func (h *Handler) GetReleasedTasks(ctx context.Context, input *GetReleasedTasksInput) (*GetReleasedTasksOutput, error) {
	uid, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Please log in to continue", err)
	}
	userID, err := primitive.ObjectIDFromHex(uid)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}
	tasks, err := h.service.GetReleasedTasks(ctx, userID)
	if err != nil {
		return nil, huma.Error500InternalServerError("Unable to load released tasks. Please try again.", err)
	}
	out := &GetReleasedTasksOutput{}
	out.Body.Tasks = tasks
	return out, nil
}

// BreakdownSuggestions handles POST .../breakdown-suggestions. Planning is
// never paywalled: no credit gate, and any AI failure returns an empty list.
func (h *Handler) BreakdownSuggestions(ctx context.Context, input *BreakdownSuggestionsInput) (*BreakdownSuggestionsOutput, error) {
	userID, categoryID, taskID, err := resolveTaskPath(ctx, input.Category, input.ID)
	if err != nil {
		return nil, err
	}
	size := input.Body.Size
	if !types.ValidPlanSize(size) {
		size = types.PlanSize10m
	}
	task, err := h.service.loadOwnedTask(ctx, userID, categoryID, taskID)
	if err != nil {
		return nil, graceError(err, "load the task")
	}

	out := &BreakdownSuggestionsOutput{}
	out.Body.Steps = []string{}
	checklist := make([]string, 0, len(task.Checklist))
	for _, c := range task.Checklist {
		if !c.Completed {
			checklist = append(checklist, c.Content)
		}
	}
	flowInput := map[string]any{"content": task.Content, "notes": task.Notes, "checklist": checklist, "size": size}
	var draft breakdownDraft
	if err := runGeminiFlow(ctx, h.geminiService, "SuggestBreakdownFlow", flowInput, &draft); err != nil {
		slog.LogAttrs(ctx, slog.LevelWarn, "Breakdown suggestion failed", slog.String("taskId", taskID.Hex()), slog.String("error", err.Error()))
		return out, nil
	}
	out.Body.Steps = CleanBreakdownSteps(draft.Steps)
	out.Body.WhenHint = strings.TrimSpace(draft.WhenHint)
	return out, nil
}

// --- Registration ---

// RegisterGraceOperations registers plan, park, release and breakdown
// endpoints. The static paths must come before /{category} routes.
func RegisterGraceOperations(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "bulk-release-tasks",
		Method:      http.MethodPost,
		Path:        "/v1/user/tasks/release-bulk",
		Summary:     "Release many tasks",
		Description: "Releases a batch of tasks at once. Released tasks are kept and can be restored.",
		Tags:        []string{"tasks"},
	}, handler.BulkReleaseTasks)
	huma.Register(api, huma.Operation{
		OperationID: "get-released-tasks",
		Method:      http.MethodGet,
		Path:        "/v1/user/tasks/released",
		Summary:     "List released tasks",
		Description: "Tasks the user let go, most recent first.",
		Tags:        []string{"tasks"},
	}, handler.GetReleasedTasks)
	for _, method := range []string{http.MethodPut, http.MethodPatch} {
		huma.Register(api, huma.Operation{
			OperationID: strings.ToLower(method) + "-task-plan",
			Method:      method,
			Path:        "/v1/user/tasks/{category}/{id}/plan",
			Summary:     "Set a task plan",
			Description: "Commits a small next step. Moves the task's start to the plan time, adds one reminder there, and optionally appends breakdown steps to the checklist. Replacing a plan counts a replan.",
			Tags:        []string{"tasks"},
		}, handler.SetTaskPlan)
	}
	huma.Register(api, huma.Operation{
		OperationID: "clear-task-plan",
		Method:      http.MethodDelete,
		Path:        "/v1/user/tasks/{category}/{id}/plan",
		Summary:     "Clear a task plan",
		Description: "Removes the plan and its pending reminder.",
		Tags:        []string{"tasks"},
	}, handler.ClearTaskPlan)
	huma.Register(api, huma.Operation{
		OperationID: "park-task",
		Method:      http.MethodPost,
		Path:        "/v1/user/tasks/{category}/{id}/park",
		Summary:     "Park a task",
		Tags:        []string{"tasks"},
	}, handler.ParkTask)
	huma.Register(api, huma.Operation{
		OperationID: "unpark-task",
		Method:      http.MethodPost,
		Path:        "/v1/user/tasks/{category}/{id}/unpark",
		Summary:     "Unpark a task",
		Tags:        []string{"tasks"},
	}, handler.UnparkTask)
	huma.Register(api, huma.Operation{
		OperationID: "release-task",
		Method:      http.MethodPost,
		Path:        "/v1/user/tasks/{category}/{id}/release",
		Summary:     "Release a task",
		Description: "Hides the task from every list, reminder and count. Recoverable with unrelease.",
		Tags:        []string{"tasks"},
	}, handler.ReleaseTask)
	huma.Register(api, huma.Operation{
		OperationID: "unrelease-task",
		Method:      http.MethodPost,
		Path:        "/v1/user/tasks/{category}/{id}/unrelease",
		Summary:     "Restore a released task",
		Tags:        []string{"tasks"},
	}, handler.UnreleaseTask)
	huma.Register(api, huma.Operation{
		OperationID: "breakdown-suggestions",
		Method:      http.MethodPost,
		Path:        "/v1/user/tasks/{category}/{id}/breakdown-suggestions",
		Summary:     "Suggest small first steps",
		Description: "Suggests 2-4 tiny first steps that fit the chosen size. Consumes no credits and returns an empty list when AI is unavailable.",
		Tags:        []string{"tasks", "ai"},
	}, handler.BreakdownSuggestions)
}
