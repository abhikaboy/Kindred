package task

import (
	"strings"
	"testing"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"github.com/abhikaboy/Kindred/xutils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// ========================================
// Unit tests (no MongoDB)
// ========================================

func TestPlanReminderCopy(t *testing.T) {
	svc := &Service{}
	step := "Open the tax folder"
	msg := PlanReminderCopy(step)
	task := &TaskDocument{Content: "Do taxes", Plan: &TaskPlan{Step: step}}
	past := time.Now().Add(-48 * time.Hour)
	task.Deadline = &past

	got := svc.generateReminderMessage(&Reminder{Type: PlanReminderType, CustomMessage: &msg}, task)
	assert.Equal(t, "Try: Open the tax folder", got)

	// Without stored copy it falls back to the plan step
	got = svc.generateReminderMessage(&Reminder{Type: PlanReminderType}, task)
	assert.Equal(t, "Try: Open the tax folder", got)

	for _, word := range []string{"overdue", "missed", "late", "ago", "due"} {
		assert.NotContains(t, strings.ToLower(got), word)
	}
}

func TestWithoutPlanReminders(t *testing.T) {
	sentPlan := &Reminder{Type: PlanReminderType, Sent: true}
	other := &Reminder{Type: "ABSOLUTE"}
	out := withoutPlanReminders([]*Reminder{{Type: PlanReminderType}, other, sentPlan})
	assert.Equal(t, []*Reminder{other, sentPlan}, out)
}

func TestAppendPlanSteps(t *testing.T) {
	existing := []ChecklistItem{{Content: "Find receipts", Order: 0}}
	out := appendPlanSteps(existing, "Open the folder", []string{"find receipts", " Fill page one ", ""})
	contents := []string{}
	for _, c := range out {
		contents = append(contents, c.Content)
	}
	assert.Equal(t, []string{"Find receipts", "Open the folder", "Fill page one"}, contents)
	assert.Equal(t, 1, out[1].Order)
	assert.Equal(t, 2, out[2].Order)
}

func TestCleanBreakdownSteps(t *testing.T) {
	got := CleanBreakdownSteps([]string{" Open the doc.", "open the doc", "", "Write one line", "Send it", "Close laptop", "Stretch"})
	assert.Equal(t, []string{"Open the doc", "Write one line", "Send it", "Close laptop"}, got)
	assert.Empty(t, CleanBreakdownSteps(nil))
}

func TestWithoutReleased(t *testing.T) {
	now := time.Now()
	kept := TaskDocument{Content: "keep"}
	out := types.WithoutReleased([]TaskDocument{kept, {Content: "gone", ReleasedAt: &now}})
	assert.Len(t, out, 1)
	assert.Equal(t, "keep", out[0].Content)
}

// ========================================
// MongoDB-backed tests
// ========================================

type GraceTestSuite struct {
	testpkg.BaseSuite
	service *Service
}

func (s *GraceTestSuite) SetupTest() {
	s.BaseSuite.SetupTest()
	s.service = NewService(s.Collections)
}

func TestGrace(t *testing.T) {
	suite.Run(t, new(GraceTestSuite))
}

func (s *GraceTestSuite) insertCategory(userID primitive.ObjectID, tasks ...TaskDocument) primitive.ObjectID {
	cat := &types.CategoryDocument{
		ID:            primitive.NewObjectID(),
		Name:          "Grace",
		User:          userID,
		WorkspaceName: "Test Workspace",
		Tasks:         tasks,
	}
	_, err := s.Collections["categories"].InsertOne(s.Ctx, cat)
	s.Require().NoError(err)
	return cat.ID
}

func (s *GraceTestSuite) newTask(content string) TaskDocument {
	yesterday := xutils.NowUTC().Add(-24 * time.Hour)
	return TaskDocument{
		ID:        primitive.NewObjectID(),
		Content:   content,
		Priority:  1,
		Value:     1,
		Active:    true,
		Timestamp: xutils.NowUTC(),
		StartDate: &yesterday,
	}
}

func planReminders(t TaskDocument) []*Reminder {
	var out []*Reminder
	for _, r := range t.Reminders {
		if r.Type == PlanReminderType {
			out = append(out, r)
		}
	}
	return out
}

func (s *GraceTestSuite) TestSetPlanAndReplan() {
	userID := s.GetUser(0).ID
	task := s.newTask("Do taxes")
	task.Checklist = []ChecklistItem{{Content: "Find receipts"}}
	catID := s.insertCategory(userID, task)

	at := xutils.NowUTC().Add(2 * time.Hour).Truncate(time.Millisecond)
	got, err := s.service.SetTaskPlan(s.Ctx, userID, catID, task.ID, SetTaskPlanBody{
		Step: "Open the tax folder", Size: types.PlanSize2m, At: at, Steps: []string{"Fill page one"},
	})
	s.Require().NoError(err)
	s.Require().NotNil(got.Plan)
	s.Equal("Open the tax folder", got.Plan.Step)
	s.Equal(0, got.Plan.Replans)
	s.True(got.StartDate.Equal(at))
	s.True(got.StartTime.Equal(at))
	s.Equal(1, got.RescheduleCount)
	s.Len(got.Checklist, 3)
	s.Equal("Open the tax folder", got.Checklist[1].Content)

	rs := planReminders(*got)
	s.Require().Len(rs, 1)
	s.True(rs[0].TriggerTime.Equal(at))
	s.Require().NotNil(rs[0].CustomMessage)
	s.Equal("Try: Open the tax folder", *rs[0].CustomMessage)

	// Replan: counter goes up, still exactly one plan reminder
	later := at.Add(24 * time.Hour)
	got, err = s.service.SetTaskPlan(s.Ctx, userID, catID, task.ID, SetTaskPlanBody{
		Step: "Print one form", Size: types.PlanSize10m, At: later,
	})
	s.Require().NoError(err)
	s.Equal(1, got.Plan.Replans)
	s.Len(got.Checklist, 3)
	rs = planReminders(*got)
	s.Require().Len(rs, 1)
	s.Equal("Try: Print one form", *rs[0].CustomMessage)
	s.True(rs[0].TriggerTime.Equal(later))

	// Clearing removes the plan and its reminder
	got, err = s.service.ClearTaskPlan(s.Ctx, userID, catID, task.ID)
	s.Require().NoError(err)
	s.Nil(got.Plan)
	s.Empty(planReminders(*got))
}

func (s *GraceTestSuite) TestSetPlanRejectsOtherUsersTask() {
	owner := s.GetUser(0).ID
	task := s.newTask("Private")
	catID := s.insertCategory(owner, task)
	_, err := s.service.SetTaskPlan(s.Ctx, primitive.NewObjectID(), catID, task.ID, SetTaskPlanBody{
		Step: "Look", Size: types.PlanSize2m, At: xutils.NowUTC(),
	})
	s.ErrorIs(err, ErrTaskNotFound)
}

func (s *GraceTestSuite) TestParkAndUnpark() {
	userID := s.GetUser(0).ID
	task := s.newTask("Park me")
	catID := s.insertCategory(userID, task)

	s.Require().NoError(s.service.SetTaskParked(s.Ctx, userID, catID, task.ID, true))
	got, err := s.service.loadOwnedTask(s.Ctx, userID, catID, task.ID)
	s.Require().NoError(err)
	s.NotNil(got.ParkedAt)

	s.Require().NoError(s.service.SetTaskParked(s.Ctx, userID, catID, task.ID, false))
	got, err = s.service.loadOwnedTask(s.Ctx, userID, catID, task.ID)
	s.Require().NoError(err)
	s.Nil(got.ParkedAt)
}

func taskIDs(tasks []TaskDocument) []primitive.ObjectID {
	out := make([]primitive.ObjectID, 0, len(tasks))
	for _, t := range tasks {
		out = append(out, t.ID)
	}
	return out
}

func (s *GraceTestSuite) TestReleasedTasksAreExcludedFromLists() {
	userID := s.GetUser(0).ID
	past := xutils.NowUTC().Add(-time.Hour)
	kept := s.newTask("Keep")
	gone := s.newTask("Let go")
	gone.Reminders = []*Reminder{{TriggerTime: past, Type: "ABSOLUTE"}}
	kept.Reminders = []*Reminder{{TriggerTime: past, Type: "ABSOLUTE"}}
	catID := s.insertCategory(userID, kept, gone)

	countsBefore, err := s.service.GetUserTaskCountsForTodayWithTimezone(userID, time.UTC)
	s.Require().NoError(err)

	s.Require().NoError(s.service.SetTaskReleased(s.Ctx, userID, catID, gone.ID, true))

	all, err := s.service.GetTasksByUser(userID, bson.D{{Key: "$sort", Value: bson.M{"timestamp": 1}}})
	s.Require().NoError(err)
	s.Contains(taskIDs(all), kept.ID)
	s.NotContains(taskIDs(all), gone.ID)

	active, err := s.service.GetActiveTasks(userID)
	s.Require().NoError(err)
	s.NotContains(taskIDs(active), gone.ID)

	queried, err := s.service.QueryTasksByUser(userID, TaskQueryFilters{})
	s.Require().NoError(err)
	s.Contains(taskIDs(queried), kept.ID)
	s.NotContains(taskIDs(queried), gone.ID)

	withReminders, err := s.service.GetTasksWithPastReminders()
	s.Require().NoError(err)
	s.Contains(taskIDs(withReminders), kept.ID)
	s.NotContains(taskIDs(withReminders), gone.ID)

	counts, err := s.service.GetUserTaskCountsForTodayWithTimezone(userID, time.UTC)
	s.Require().NoError(err)
	s.Equal(countsBefore.ScheduledToday-1, counts.ScheduledToday)

	// Whole-category reads (workspaces, widgets) drop released tasks too
	cursor, err := s.Collections["categories"].Aggregate(s.Ctx, mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"_id": catID}}},
		types.DropReleasedTasksStage(),
	})
	s.Require().NoError(err)
	var cats []types.CategoryDocument
	s.Require().NoError(cursor.All(s.Ctx, &cats))
	s.Require().Len(cats, 1)
	s.Equal([]primitive.ObjectID{kept.ID}, taskIDs(cats[0].Tasks))

	released, err := s.service.GetReleasedTasks(s.Ctx, userID)
	s.Require().NoError(err)
	s.Equal([]primitive.ObjectID{gone.ID}, taskIDs(released))
	s.Equal(catID, released[0].CategoryID)

	// Restoring brings it back without re-firing the reminder that came due meanwhile
	s.Require().NoError(s.service.SetTaskReleased(s.Ctx, userID, catID, gone.ID, false))
	all, err = s.service.GetTasksByUser(userID, bson.D{{Key: "$sort", Value: bson.M{"timestamp": 1}}})
	s.Require().NoError(err)
	s.Contains(taskIDs(all), gone.ID)
	withReminders, err = s.service.GetTasksWithPastReminders()
	s.Require().NoError(err)
	s.NotContains(taskIDs(withReminders), gone.ID)
}

func (s *GraceTestSuite) TestBulkRelease() {
	userID := s.GetUser(0).ID
	a, b, c := s.newTask("A"), s.newTask("B"), s.newTask("C")
	cat1 := s.insertCategory(userID, a, b)
	cat2 := s.insertCategory(userID, c)
	foreign := s.newTask("Not mine")
	foreignCat := s.insertCategory(primitive.NewObjectID(), foreign)

	released, failed, err := s.service.BulkReleaseTasks(s.Ctx, userID, []ReleaseTaskItem{
		{TaskID: a.ID.Hex(), CategoryID: cat1.Hex()},
		{TaskID: b.ID.Hex(), CategoryID: cat1.Hex()},
		{TaskID: c.ID.Hex(), CategoryID: cat2.Hex()},
		{TaskID: foreign.ID.Hex(), CategoryID: foreignCat.Hex()},
		{TaskID: "bad", CategoryID: cat1.Hex()},
	})
	s.Require().NoError(err)
	s.Equal(3, released)
	s.ElementsMatch([]string{foreign.ID.Hex(), "bad"}, failed)

	list, err := s.service.GetReleasedTasks(s.Ctx, userID)
	s.Require().NoError(err)
	s.ElementsMatch([]primitive.ObjectID{a.ID, b.ID, c.ID}, taskIDs(list))

	all, err := s.service.GetTasksByUser(userID, bson.D{{Key: "$sort", Value: bson.M{"timestamp": 1}}})
	s.Require().NoError(err)
	for _, id := range []primitive.ObjectID{a.ID, b.ID, c.ID} {
		s.NotContains(taskIDs(all), id)
	}

	// The other user's task is untouched
	other, err := s.service.loadOwnedTask(s.Ctx, primitive.NilObjectID, foreignCat, foreign.ID)
	s.ErrorIs(err, ErrTaskNotFound)
	s.Nil(other)

	// Releasing again reports them as already released
	released, failed, err = s.service.BulkReleaseTasks(s.Ctx, userID, []ReleaseTaskItem{{TaskID: a.ID.Hex(), CategoryID: cat1.Hex()}})
	s.Require().NoError(err)
	s.Equal(0, released)
	s.Equal([]string{a.ID.Hex()}, failed)
}
