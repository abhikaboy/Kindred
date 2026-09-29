package task

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/auth"
	"github.com/abhikaboy/Kindred/xutils"
	"github.com/danielgtaylor/huma/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// Someday tasks are undated and aspirational. They keep their category and
// workspace, but carry no dates, plan or pending reminders, and are left out of
// waiting, check-in, reminder and attention paths. Planning one (see
// SetTaskPlan) turns it back into a normal task.

// applyCreateSchedule fills in the schedule of a task being created. Someday
// tasks stay undated; everything else defaults its start date to today and
// gets a follow-up reminder when it has a deadline or start time.
func applyCreateSchedule(task *TaskDocument, someday bool, now time.Time) {
	if someday {
		at := now.UTC()
		task.SomedayAt = &at
		task.StartDate = nil
		task.StartTime = nil
		task.Deadline = nil
		task.Reminders = nil
		return
	}

	if followUp := BuildFollowUpReminder(task.Deadline, task.StartTime); followUp != nil {
		task.Reminders = append(task.Reminders, followUp)
	}

	// Frontend sends a pre-combined startDate (date + time in local timezone),
	// so only the nil case needs a default.
	if task.StartDate == nil {
		if task.StartTime != nil {
			hour, min, sec := task.StartTime.Clock()
			combined := time.Date(now.Year(), now.Month(), now.Day(), hour, min, sec, 0, now.Location())
			task.StartDate = &combined
		} else {
			today := now
			task.StartDate = &today
		}
	}
}

// withoutUnsentReminders keeps only reminders that already fired.
func withoutUnsentReminders(reminders []*Reminder) []*Reminder {
	out := make([]*Reminder, 0, len(reminders))
	for _, r := range reminders {
		if r != nil && r.Sent {
			out = append(out, r)
		}
	}
	return out
}

// SetTaskSomeday moves a task to Someday: it loses its dates, plan and unsent
// reminders, and optionally gains breakdown steps on its checklist.
func (s *Service) SetTaskSomeday(ctx context.Context, userID, categoryID, taskID primitive.ObjectID, steps []string) (*TaskDocument, error) {
	current, err := s.loadOwnedTask(ctx, userID, categoryID, taskID)
	if err != nil {
		return nil, err
	}
	now := xutils.NowUTC()
	set := bson.M{
		"tasks.$[t].somedayAt":  now,
		"tasks.$[t].startDate":  nil,
		"tasks.$[t].reminders":  withoutUnsentReminders(current.Reminders),
		"tasks.$[t].lastEdited": now,
	}
	if len(steps) > 0 {
		set["tasks.$[t].checklist"] = appendPlanSteps(current.Checklist, "", steps)
	}
	update := bson.M{
		"$set": set,
		"$unset": bson.M{
			"tasks.$[t].startTime": "",
			"tasks.$[t].deadline":  "",
			"tasks.$[t].plan":      "",
		},
	}
	if err := s.updateOwnedTask(ctx, userID, categoryID, taskID, update); err != nil {
		return nil, err
	}
	return s.loadOwnedTask(ctx, userID, categoryID, taskID)
}

// ClearTaskSomeday takes a task out of Someday. It stays undated until the
// user schedules or plans it.
func (s *Service) ClearTaskSomeday(ctx context.Context, userID, categoryID, taskID primitive.ObjectID) (*TaskDocument, error) {
	if err := s.setTaskTimestampField(ctx, userID, categoryID, taskID, "somedayAt", false); err != nil {
		return nil, err
	}
	return s.loadOwnedTask(ctx, userID, categoryID, taskID)
}

// GetSomedayTasks lists the user's unreleased Someday tasks, most recent first.
func (s *Service) GetSomedayTasks(ctx context.Context, userID primitive.ObjectID) ([]TaskDocument, error) {
	cursor, err := s.Tasks.Aggregate(ctx, mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"user": userID}}},
		{{Key: "$unwind", Value: "$tasks"}},
		{{Key: "$match", Value: bson.M{"tasks.somedayAt": bson.M{"$ne": nil}, "tasks.releasedAt": nil}}},
		{{Key: "$set", Value: bson.M{"tasks.userID": "$user", "tasks.categoryID": "$_id"}}},
		{{Key: "$replaceRoot", Value: bson.M{"newRoot": "$tasks"}}},
		{{Key: "$sort", Value: bson.D{{Key: "somedayAt", Value: -1}}}},
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

// --- Operations ---

type SetTaskSomedayInput struct {
	Authorization string `header:"Authorization" required:"true"`
	Category      string `path:"category" example:"507f1f77bcf86cd799439011"`
	ID            string `path:"id" example:"507f1f77bcf86cd799439011"`
	Body          *struct {
		Steps []string `json:"steps,omitempty" maxItems:"6" doc:"Breakdown steps to append to the checklist"`
	} `required:"false"`
}

type GetSomedayTasksInput struct {
	Authorization string `header:"Authorization" required:"true"`
}

type GetSomedayTasksOutput struct {
	Body struct {
		Tasks []TaskDocument `json:"tasks"`
	}
}

// --- Handlers ---

func (h *Handler) SetTaskSomeday(ctx context.Context, input *SetTaskSomedayInput) (*TaskPlanOutput, error) {
	userID, categoryID, taskID, err := resolveTaskPath(ctx, input.Category, input.ID)
	if err != nil {
		return nil, err
	}
	var steps []string
	if input.Body != nil {
		steps = input.Body.Steps
	}
	if len(steps) > planMaxSteps {
		steps = steps[:planMaxSteps]
	}
	task, err := h.service.SetTaskSomeday(ctx, userID, categoryID, taskID, steps)
	if err != nil {
		slog.Error("Failed to move task to Someday", "taskId", taskID.Hex(), "error", err)
		return nil, graceError(err, "move the task to Someday")
	}
	return &TaskPlanOutput{Body: *task}, nil
}

func (h *Handler) ClearTaskSomeday(ctx context.Context, input *TaskPathInput) (*TaskPlanOutput, error) {
	userID, categoryID, taskID, err := resolveTaskPath(ctx, input.Category, input.ID)
	if err != nil {
		return nil, err
	}
	task, err := h.service.ClearTaskSomeday(ctx, userID, categoryID, taskID)
	if err != nil {
		slog.Error("Failed to clear Someday", "taskId", taskID.Hex(), "error", err)
		return nil, graceError(err, "take the task out of Someday")
	}
	return &TaskPlanOutput{Body: *task}, nil
}

func (h *Handler) GetSomedayTasks(ctx context.Context, input *GetSomedayTasksInput) (*GetSomedayTasksOutput, error) {
	uid, err := auth.RequireAuth(ctx)
	if err != nil {
		return nil, huma.Error401Unauthorized("Please log in to continue", err)
	}
	userID, err := primitive.ObjectIDFromHex(uid)
	if err != nil {
		return nil, huma.Error400BadRequest("Invalid user ID format", err)
	}
	tasks, err := h.service.GetSomedayTasks(ctx, userID)
	if err != nil {
		return nil, huma.Error500InternalServerError("Unable to load Someday tasks. Please try again.", err)
	}
	out := &GetSomedayTasksOutput{}
	out.Body.Tasks = tasks
	return out, nil
}

// registerSomedayOperations must run before the /{category} routes so the
// static /someday path wins.
func registerSomedayOperations(api huma.API, handler *Handler) {
	huma.Register(api, huma.Operation{
		OperationID: "get-someday-tasks",
		Method:      http.MethodGet,
		Path:        "/v1/user/tasks/someday",
		Summary:     "List Someday tasks",
		Description: "Undated tasks the user moved to Someday, most recent first. Released tasks are left out.",
		Tags:        []string{"tasks"},
	}, handler.GetSomedayTasks)
	huma.Register(api, huma.Operation{
		OperationID: "set-task-someday",
		Method:      http.MethodPost,
		Path:        "/v1/user/tasks/{category}/{id}/someday",
		Summary:     "Move a task to Someday",
		Description: "Clears the task's start date, start time, deadline, plan and unsent reminders. Optionally appends breakdown steps to the checklist.",
		Tags:        []string{"tasks"},
	}, handler.SetTaskSomeday)
	huma.Register(api, huma.Operation{
		OperationID: "clear-task-someday",
		Method:      http.MethodDelete,
		Path:        "/v1/user/tasks/{category}/{id}/someday",
		Summary:     "Take a task out of Someday",
		Tags:        []string{"tasks"},
	}, handler.ClearTaskSomeday)
}
