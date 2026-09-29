package task

import (
	"time"

	"testing"

	"github.com/abhikaboy/Kindred/xutils"
	"github.com/stretchr/testify/assert"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestApplyCreateScheduleSomeday(t *testing.T) {
	now := time.Date(2026, 9, 29, 10, 0, 0, 0, time.UTC)
	deadline := now.Add(48 * time.Hour)
	task := &TaskDocument{Deadline: &deadline, StartTime: &now}
	applyCreateSchedule(task, true, now)
	assert.Nil(t, task.StartDate)
	assert.Nil(t, task.StartTime)
	assert.Nil(t, task.Deadline)
	assert.Empty(t, task.Reminders)
	if assert.NotNil(t, task.SomedayAt) {
		assert.True(t, task.SomedayAt.Equal(now))
	}

	// A normal task still defaults to today
	normal := &TaskDocument{}
	applyCreateSchedule(normal, false, now)
	if assert.NotNil(t, normal.StartDate) {
		assert.True(t, normal.StartDate.Equal(now))
	}
	assert.Nil(t, normal.SomedayAt)
}

func TestWithoutUnsentReminders(t *testing.T) {
	sent := &Reminder{Type: "ABSOLUTE", Sent: true}
	out := withoutUnsentReminders([]*Reminder{{Type: "ABSOLUTE"}, sent, nil})
	assert.Equal(t, []*Reminder{sent}, out)
}

func (s *GraceTestSuite) TestSetAndClearSomeday() {
	userID := s.GetUser(0).ID
	task := s.newTask("Learn piano")
	now := xutils.NowUTC()
	deadline := now.Add(24 * time.Hour)
	task.StartTime = &now
	task.Deadline = &deadline
	task.Plan = &TaskPlan{Step: "Find a teacher", At: now}
	sent := &Reminder{TriggerTime: now.Add(-time.Hour), Type: "ABSOLUTE", Sent: true}
	task.Reminders = []*Reminder{{TriggerTime: now.Add(time.Hour), Type: "ABSOLUTE"}, sent}
	task.Checklist = []ChecklistItem{{Content: "Buy keyboard"}}
	catID := s.insertCategory(userID, task)

	got, err := s.service.SetTaskSomeday(s.Ctx, userID, catID, task.ID, []string{"buy keyboard", "Watch one lesson"})
	s.Require().NoError(err)
	s.NotNil(got.SomedayAt)
	s.Nil(got.StartDate)
	s.Nil(got.StartTime)
	s.Nil(got.Deadline)
	s.Nil(got.Plan)
	s.Require().Len(got.Reminders, 1)
	s.True(got.Reminders[0].Sent)
	s.Require().Len(got.Checklist, 2)
	s.Equal("Watch one lesson", got.Checklist[1].Content)

	got, err = s.service.ClearTaskSomeday(s.Ctx, userID, catID, task.ID)
	s.Require().NoError(err)
	s.Nil(got.SomedayAt)
	s.Nil(got.StartDate)

	_, err = s.service.SetTaskSomeday(s.Ctx, primitive.NewObjectID(), catID, task.ID, nil)
	s.ErrorIs(err, ErrTaskNotFound)
}

func (s *GraceTestSuite) TestPlanningClearsSomeday() {
	userID := s.GetUser(0).ID
	task := s.newTask("Write a novel")
	catID := s.insertCategory(userID, task)
	_, err := s.service.SetTaskSomeday(s.Ctx, userID, catID, task.ID, nil)
	s.Require().NoError(err)

	at := xutils.NowUTC().Add(time.Hour).Truncate(time.Millisecond)
	got, err := s.service.SetTaskPlan(s.Ctx, userID, catID, task.ID, SetTaskPlanBody{Step: "Outline chapter one", Size: "10m", At: at})
	s.Require().NoError(err)
	s.Nil(got.SomedayAt)
	s.Require().NotNil(got.StartDate)
	s.True(got.StartDate.Equal(at))
}

func (s *GraceTestSuite) TestSomedayListAndExclusions() {
	userID := s.GetUser(0).ID
	past := xutils.NowUTC().Add(-time.Hour)
	normal := s.newTask("Normal")
	normal.Reminders = []*Reminder{{TriggerTime: past, Type: "ABSOLUTE"}}
	dream := s.newTask("Visit Japan")
	dream.StartDate = nil
	dream.SomedayAt = &past
	dream.Reminders = []*Reminder{{TriggerTime: past, Type: "ABSOLUTE"}}
	gone := s.newTask("Released dream")
	gone.StartDate = nil
	gone.SomedayAt = &past
	gone.ReleasedAt = &past
	catID := s.insertCategory(userID, normal, dream, gone)

	// Still in the normal task lists
	all, err := s.service.GetTasksByUser(userID, bson.D{{Key: "$sort", Value: bson.M{"timestamp": 1}}})
	s.Require().NoError(err)
	s.Contains(taskIDs(all), dream.ID)

	list, err := s.service.GetSomedayTasks(s.Ctx, userID)
	s.Require().NoError(err)
	s.Equal([]primitive.ObjectID{dream.ID}, taskIDs(list))
	s.Equal(catID, list[0].CategoryID)

	withReminders, err := s.service.GetTasksWithPastReminders()
	s.Require().NoError(err)
	s.Contains(taskIDs(withReminders), normal.ID)
	s.NotContains(taskIDs(withReminders), dream.ID)

	// Check-in counts: the same task counts as waiting until it moves to Someday
	countsBefore, err := s.service.GetUserTaskCountsForTodayWithTimezone(userID, time.UTC)
	s.Require().NoError(err)
	_, err = s.service.SetTaskSomeday(s.Ctx, userID, catID, normal.ID, nil)
	s.Require().NoError(err)
	counts, err := s.service.GetUserTaskCountsForTodayWithTimezone(userID, time.UTC)
	s.Require().NoError(err)
	s.Equal(countsBefore.ScheduledToday-1, counts.ScheduledToday)
}
