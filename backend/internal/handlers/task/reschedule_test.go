package task

import (
	"testing"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"github.com/abhikaboy/Kindred/xutils"
	"github.com/stretchr/testify/suite"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// RescheduleCountTestSuite covers TaskDocument.RescheduleCount, which only
// moves when startDate or deadline lands on a different value. Nothing reads
// the counter yet — these tests exist so it is not quietly counting ordinary
// edits by the time somebody does.
type RescheduleCountTestSuite struct {
	testpkg.BaseSuite
	service *Service
}

func (s *RescheduleCountTestSuite) SetupTest() {
	s.BaseSuite.SetupTest()
	s.service = NewService(s.Collections)
}

func TestRescheduleCount(t *testing.T) {
	suite.Run(t, new(RescheduleCountTestSuite))
}

func (s *RescheduleCountTestSuite) insertTask(userID primitive.ObjectID, task TaskDocument) primitive.ObjectID {
	cat := &types.CategoryDocument{
		ID:            primitive.NewObjectID(),
		Name:          "Reschedule",
		User:          userID,
		WorkspaceName: "Test Workspace",
		Tasks:         []TaskDocument{task},
	}
	_, err := s.Collections["categories"].InsertOne(s.Ctx, cat)
	s.Require().NoError(err)
	return cat.ID
}

// loadTask reads the task back through BSON, so tests compare against the
// millisecond-truncated values MongoDB actually stores rather than the
// nanosecond values Go started with.
func (s *RescheduleCountTestSuite) loadTask(categoryID, taskID primitive.ObjectID) TaskDocument {
	var cat types.CategoryDocument
	err := s.Collections["categories"].FindOne(s.Ctx, bson.M{"_id": categoryID}).Decode(&cat)
	s.Require().NoError(err)
	for _, t := range cat.Tasks {
		if t.ID == taskID {
			return t
		}
	}
	s.FailNow("task not found")
	return TaskDocument{}
}

func (s *RescheduleCountTestSuite) newTask(userID primitive.ObjectID, startDate, deadline *time.Time) TaskDocument {
	return TaskDocument{
		ID:        primitive.NewObjectID(),
		UserID:    userID,
		Content:   "Write the thing",
		Priority:  2,
		Value:     5,
		Active:    true,
		Timestamp: xutils.NowUTC(),
		StartDate: startDate,
		Deadline:  deadline,
	}
}

func ptrTime(t time.Time) *time.Time { return &t }

// ========================================
// UpdatePartialTask
// ========================================

func (s *RescheduleCountTestSuite) TestUpdatePartialTask_MovingStartDateCounts() {
	user := s.GetUser(0)
	start := xutils.NowUTC()
	task := s.newTask(user.ID, ptrTime(start), nil)
	categoryID := s.insertTask(user.ID, task)

	moved := start.Add(48 * time.Hour)
	_, err := s.service.UpdatePartialTask(task.ID, categoryID, UpdateTaskDocument{
		Content:   task.Content,
		Priority:  task.Priority,
		Value:     task.Value,
		StartDate: &moved,
	})

	s.NoError(err)
	s.Equal(1, s.loadTask(categoryID, task.ID).RescheduleCount)
}

func (s *RescheduleCountTestSuite) TestUpdatePartialTask_ResendingTheSameDateDoesNotCount() {
	user := s.GetUser(0)
	start := xutils.NowUTC()
	task := s.newTask(user.ID, ptrTime(start), nil)
	categoryID := s.insertTask(user.ID, task)

	// What a client does on any edit: send back the date it was given. BSON
	// only keeps milliseconds, so a naive time.Time comparison would call this
	// a reschedule every single time.
	stored := s.loadTask(categoryID, task.ID)
	_, err := s.service.UpdatePartialTask(task.ID, categoryID, UpdateTaskDocument{
		Content:   "Write the thing, better",
		Priority:  task.Priority,
		Value:     task.Value,
		StartDate: stored.StartDate,
	})

	s.NoError(err)
	s.Equal(0, s.loadTask(categoryID, task.ID).RescheduleCount)
}

func (s *RescheduleCountTestSuite) TestUpdatePartialTask_SubMillisecondDriftDoesNotCount() {
	user := s.GetUser(0)
	start := xutils.NowUTC()
	task := s.newTask(user.ID, ptrTime(start), nil)
	categoryID := s.insertTask(user.ID, task)

	stored := s.loadTask(categoryID, task.ID)
	drifted := stored.StartDate.Add(400 * time.Microsecond)

	_, err := s.service.UpdatePartialTask(task.ID, categoryID, UpdateTaskDocument{
		Content:   task.Content,
		Priority:  task.Priority,
		Value:     task.Value,
		StartDate: &drifted,
	})

	s.NoError(err)
	s.Equal(0, s.loadTask(categoryID, task.ID).RescheduleCount, "precision noise is not a reschedule")
}

func (s *RescheduleCountTestSuite) TestUpdatePartialTask_ContentOnlyEditDoesNotCount() {
	user := s.GetUser(0)
	start := xutils.NowUTC()
	task := s.newTask(user.ID, ptrTime(start), ptrTime(start.Add(72*time.Hour)))
	categoryID := s.insertTask(user.ID, task)

	_, err := s.service.UpdatePartialTask(task.ID, categoryID, UpdateTaskDocument{
		Content:  "Renamed",
		Priority: 1,
		Value:    9,
	})

	s.NoError(err)
	s.Equal(0, s.loadTask(categoryID, task.ID).RescheduleCount)
}

func (s *RescheduleCountTestSuite) TestUpdatePartialTask_MovingBothDatesCountsOnce() {
	user := s.GetUser(0)
	start := xutils.NowUTC()
	task := s.newTask(user.ID, ptrTime(start), ptrTime(start.Add(72*time.Hour)))
	categoryID := s.insertTask(user.ID, task)

	newStart := start.Add(24 * time.Hour)
	newDeadline := start.Add(96 * time.Hour)
	_, err := s.service.UpdatePartialTask(task.ID, categoryID, UpdateTaskDocument{
		Content:   task.Content,
		Priority:  task.Priority,
		Value:     task.Value,
		StartDate: &newStart,
		Deadline:  &newDeadline,
	})

	s.NoError(err)
	s.Equal(1, s.loadTask(categoryID, task.ID).RescheduleCount, "one edit that moves both dates is one reschedule")
}

func (s *RescheduleCountTestSuite) TestUpdatePartialTask_RepeatedMovesAccumulate() {
	user := s.GetUser(0)
	start := xutils.NowUTC()
	task := s.newTask(user.ID, ptrTime(start), nil)
	categoryID := s.insertTask(user.ID, task)

	for i := 1; i <= 3; i++ {
		moved := start.Add(time.Duration(i) * 24 * time.Hour)
		_, err := s.service.UpdatePartialTask(task.ID, categoryID, UpdateTaskDocument{
			Content:   task.Content,
			Priority:  task.Priority,
			Value:     task.Value,
			StartDate: &moved,
		})
		s.Require().NoError(err)
	}

	s.Equal(3, s.loadTask(categoryID, task.ID).RescheduleCount)
}

func (s *RescheduleCountTestSuite) TestUpdatePartialTask_SettingAFirstDeadlineCounts() {
	user := s.GetUser(0)
	start := xutils.NowUTC()
	task := s.newTask(user.ID, ptrTime(start), nil)
	categoryID := s.insertTask(user.ID, task)

	deadline := start.Add(72 * time.Hour)
	_, err := s.service.UpdatePartialTask(task.ID, categoryID, UpdateTaskDocument{
		Content:  task.Content,
		Priority: task.Priority,
		Value:    task.Value,
		Deadline: &deadline,
	})

	s.NoError(err)
	s.Equal(1, s.loadTask(categoryID, task.ID).RescheduleCount)
}

// ========================================
// The dedicated date endpoints
// ========================================

func (s *RescheduleCountTestSuite) TestUpdateTaskDeadline_MovingCounts() {
	user := s.GetUser(0)
	start := xutils.NowUTC()
	task := s.newTask(user.ID, ptrTime(start), ptrTime(start.Add(72*time.Hour)))
	categoryID := s.insertTask(user.ID, task)

	moved := start.Add(120 * time.Hour)
	err := s.service.UpdateTaskDeadline(task.ID, categoryID, user.ID, UpdateTaskDeadlineDocument{Deadline: &moved})

	s.NoError(err)
	s.Equal(1, s.loadTask(categoryID, task.ID).RescheduleCount)
}

func (s *RescheduleCountTestSuite) TestUpdateTaskDeadline_SameValueDoesNotCount() {
	user := s.GetUser(0)
	start := xutils.NowUTC()
	task := s.newTask(user.ID, ptrTime(start), ptrTime(start.Add(72*time.Hour)))
	categoryID := s.insertTask(user.ID, task)

	stored := s.loadTask(categoryID, task.ID)
	err := s.service.UpdateTaskDeadline(task.ID, categoryID, user.ID, UpdateTaskDeadlineDocument{Deadline: stored.Deadline})

	s.NoError(err)
	s.Equal(0, s.loadTask(categoryID, task.ID).RescheduleCount)
}

func (s *RescheduleCountTestSuite) TestUpdateTaskStart_MovingCounts() {
	user := s.GetUser(0)
	start := xutils.NowUTC()
	task := s.newTask(user.ID, ptrTime(start), nil)
	categoryID := s.insertTask(user.ID, task)

	moved := start.Add(24 * time.Hour)
	err := s.service.UpdateTaskStart(task.ID, categoryID, user.ID, UpdateTaskStartDocument{StartDate: &moved})

	s.NoError(err)
	s.Equal(1, s.loadTask(categoryID, task.ID).RescheduleCount)
}

func (s *RescheduleCountTestSuite) TestUpdateTaskStart_TimeOnlyChangeDoesNotCount() {
	user := s.GetUser(0)
	start := xutils.NowUTC()
	task := s.newTask(user.ID, ptrTime(start), nil)
	categoryID := s.insertTask(user.ID, task)

	startTime := start.Add(2 * time.Hour)
	err := s.service.UpdateTaskStart(task.ID, categoryID, user.ID, UpdateTaskStartDocument{StartTime: &startTime})

	s.NoError(err)
	s.Equal(0, s.loadTask(categoryID, task.ID).RescheduleCount)
}

// ========================================
// dateMoved
// ========================================

func (s *RescheduleCountTestSuite) TestDateMoved() {
	now := xutils.NowUTC()
	later := now.Add(time.Hour)

	s.False(dateMoved(&now, nil), "a field absent from the update is not a move")
	s.False(dateMoved(nil, nil))
	s.True(dateMoved(nil, &now), "scheduling a date that was not set is a change")
	s.True(dateMoved(&now, &later))
	s.False(dateMoved(&now, &now))
	s.False(dateMoved(&now, ptrTime(now.Add(999*time.Nanosecond))), "sub-millisecond noise is not a move")
}
