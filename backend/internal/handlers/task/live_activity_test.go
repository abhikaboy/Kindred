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

type LiveActivityTestSuite struct {
	testpkg.BaseSuite
	service *Service
	handler Handler
}

func (s *LiveActivityTestSuite) SetupTest() {
	s.BaseSuite.SetupTest()
	s.service = NewService(s.Collections)
	s.handler = Handler{
		service:       s.service,
		geminiService: nil,
	}
}

func TestLiveActivity(t *testing.T) {
	suite.Run(t, new(LiveActivityTestSuite))
}

// ========================================
// Helper: insert a category with a task
// ========================================

func (s *LiveActivityTestSuite) insertCategoryWithTask(user *types.User, task TaskDocument) (primitive.ObjectID, primitive.ObjectID) {
	categoryID := primitive.NewObjectID()
	category := &types.CategoryDocument{
		ID:            categoryID,
		Name:          "Test Category",
		User:          user.ID,
		WorkspaceName: "Test Workspace",
		Tasks:         []TaskDocument{task},
	}
	_, err := s.Collections["categories"].InsertOne(s.Ctx, category)
	s.NoError(err)
	return categoryID, task.ID
}

// ========================================
// GetTasksWithStartTimeInWindow Tests
// ========================================

func (s *LiveActivityTestSuite) TestGetTasksWithStartTimeInWindow_FindsTaskInWindow() {
	user := s.GetUser(0)
	now := xutils.NowUTC()
	startTime := now.Add(-30 * time.Second) // 30s ago — within a 2-min window

	taskID := primitive.NewObjectID()
	task := TaskDocument{
		ID:        taskID,
		UserID:    user.ID,
		Content:   "Task starting now",
		Priority:  1,
		Value:     5.0,
		Active:    true,
		StartTime: &startTime,
		Timestamp: now,
	}
	catID, _ := s.insertCategoryWithTask(user, task)
	_ = catID

	windowStart := now.Add(-2 * time.Minute)
	windowEnd := now

	results, err := s.service.GetTasksWithStartTimeInWindow(windowStart, windowEnd)
	s.NoError(err)
	s.Len(results, 1)
	s.Equal("Task starting now", results[0].Content)
}

func (s *LiveActivityTestSuite) TestGetTasksWithStartTimeInWindow_IgnoresCompletedTasks() {
	user := s.GetUser(0)
	now := xutils.NowUTC()
	startTime := now.Add(-30 * time.Second)
	completedAt := now

	taskID := primitive.NewObjectID()
	task := TaskDocument{
		ID:            taskID,
		UserID:        user.ID,
		Content:       "Completed task",
		Priority:      1,
		Value:         5.0,
		Active:        true,
		StartTime:     &startTime,
		TimeCompleted: &completedAt,
		Timestamp:     now,
	}
	s.insertCategoryWithTask(user, task)

	windowStart := now.Add(-2 * time.Minute)
	windowEnd := now

	results, err := s.service.GetTasksWithStartTimeInWindow(windowStart, windowEnd)
	s.NoError(err)
	s.Len(results, 0, "completed tasks should not be returned")
}

func (s *LiveActivityTestSuite) TestGetTasksWithStartTimeInWindow_IgnoresInactiveTasks() {
	user := s.GetUser(0)
	now := xutils.NowUTC()
	startTime := now.Add(-30 * time.Second)

	taskID := primitive.NewObjectID()
	task := TaskDocument{
		ID:        taskID,
		UserID:    user.ID,
		Content:   "Inactive task",
		Priority:  1,
		Value:     5.0,
		Active:    false,
		StartTime: &startTime,
		Timestamp: now,
	}
	s.insertCategoryWithTask(user, task)

	windowStart := now.Add(-2 * time.Minute)
	windowEnd := now

	results, err := s.service.GetTasksWithStartTimeInWindow(windowStart, windowEnd)
	s.NoError(err)
	s.Len(results, 0, "inactive tasks should not be returned")
}

func (s *LiveActivityTestSuite) TestGetTasksWithStartTimeInWindow_IgnoresTasksOutsideWindow() {
	user := s.GetUser(0)
	now := xutils.NowUTC()
	startTime := now.Add(-10 * time.Minute) // 10 min ago — outside the 2-min window

	taskID := primitive.NewObjectID()
	task := TaskDocument{
		ID:        taskID,
		UserID:    user.ID,
		Content:   "Old task",
		Priority:  1,
		Value:     5.0,
		Active:    true,
		StartTime: &startTime,
		Timestamp: now,
	}
	s.insertCategoryWithTask(user, task)

	windowStart := now.Add(-2 * time.Minute)
	windowEnd := now

	results, err := s.service.GetTasksWithStartTimeInWindow(windowStart, windowEnd)
	s.NoError(err)
	s.Len(results, 0, "tasks outside the window should not be returned")
}

// ========================================
// GetTasksWithDeadlineApproaching Tests
// ========================================

func (s *LiveActivityTestSuite) TestGetTasksWithDeadlineApproaching_FindsTaskInWindow() {
	user := s.GetUser(0)
	now := xutils.NowUTC()
	deadline := now.Add(60 * time.Minute) // exactly 1 hour from now

	taskID := primitive.NewObjectID()
	task := TaskDocument{
		ID:        taskID,
		UserID:    user.ID,
		Content:   "Task due in 1 hour",
		Priority:  2,
		Value:     5.0,
		Active:    true,
		Deadline:  &deadline,
		Timestamp: now,
	}
	s.insertCategoryWithTask(user, task)

	windowStart := now.Add(59 * time.Minute)
	windowEnd := now.Add(61 * time.Minute)

	results, err := s.service.GetTasksWithDeadlineApproaching(windowStart, windowEnd)
	s.NoError(err)
	s.Len(results, 1)
	s.Equal("Task due in 1 hour", results[0].Content)
}

func (s *LiveActivityTestSuite) TestGetTasksWithDeadlineApproaching_IgnoresCompletedTasks() {
	user := s.GetUser(0)
	now := xutils.NowUTC()
	deadline := now.Add(60 * time.Minute)
	completedAt := now

	taskID := primitive.NewObjectID()
	task := TaskDocument{
		ID:            taskID,
		UserID:        user.ID,
		Content:       "Completed task with deadline",
		Priority:      2,
		Value:         5.0,
		Active:        true,
		Deadline:      &deadline,
		TimeCompleted: &completedAt,
		Timestamp:     now,
	}
	s.insertCategoryWithTask(user, task)

	windowStart := now.Add(59 * time.Minute)
	windowEnd := now.Add(61 * time.Minute)

	results, err := s.service.GetTasksWithDeadlineApproaching(windowStart, windowEnd)
	s.NoError(err)
	s.Len(results, 0, "completed tasks should not be returned")
}

func (s *LiveActivityTestSuite) TestGetTasksWithDeadlineApproaching_IgnoresDistantDeadlines() {
	user := s.GetUser(0)
	now := xutils.NowUTC()
	deadline := now.Add(5 * time.Hour) // 5 hours away

	taskID := primitive.NewObjectID()
	task := TaskDocument{
		ID:        taskID,
		UserID:    user.ID,
		Content:   "Far-off deadline",
		Priority:  1,
		Value:     5.0,
		Active:    true,
		Deadline:  &deadline,
		Timestamp: now,
	}
	s.insertCategoryWithTask(user, task)

	windowStart := now.Add(59 * time.Minute)
	windowEnd := now.Add(61 * time.Minute)

	results, err := s.service.GetTasksWithDeadlineApproaching(windowStart, windowEnd)
	s.NoError(err)
	s.Len(results, 0, "tasks with distant deadlines should not be returned")
}

// ========================================
// getCategoryWorkspaceName Tests
// ========================================

func (s *LiveActivityTestSuite) TestGetCategoryWorkspaceName_ReturnsWorkspaceName() {
	user := s.GetUser(0)
	categoryID := primitive.NewObjectID()
	category := &types.CategoryDocument{
		ID:            categoryID,
		Name:          "Test",
		User:          user.ID,
		WorkspaceName: "My Workspace",
		Tasks:         []TaskDocument{},
	}
	_, err := s.Collections["categories"].InsertOne(s.Ctx, category)
	s.NoError(err)

	name := s.service.getCategoryWorkspaceName(categoryID)
	s.Equal("My Workspace", name)
}

func (s *LiveActivityTestSuite) TestGetCategoryWorkspaceName_DefaultsToTasks() {
	nonExistentID := primitive.NewObjectID()
	name := s.service.getCategoryWorkspaceName(nonExistentID)
	s.Equal("Tasks", name)
}

func (s *LiveActivityTestSuite) TestGetCategoryWorkspaceName_DefaultsWhenEmpty() {
	user := s.GetUser(0)
	categoryID := primitive.NewObjectID()
	category := &types.CategoryDocument{
		ID:            categoryID,
		Name:          "Test",
		User:          user.ID,
		WorkspaceName: "",
		Tasks:         []TaskDocument{},
	}
	_, err := s.Collections["categories"].InsertOne(s.Ctx, category)
	s.NoError(err)

	name := s.service.getCategoryWorkspaceName(categoryID)
	s.Equal("Tasks", name)
}

// ========================================
// HandleStartTimeNotifications Tests
// ========================================

func (s *LiveActivityTestSuite) TestHandleStartTimeNotifications_SendsNotification() {
	user := s.GetUser(0)
	now := xutils.NowUTC()
	startTime := now.Add(-30 * time.Second)

	taskID := primitive.NewObjectID()
	task := TaskDocument{
		ID:        taskID,
		UserID:    user.ID,
		Content:   "Start this task",
		Priority:  2,
		Value:     5.0,
		Active:    true,
		StartTime: &startTime,
		Timestamp: now,
	}
	catID, _ := s.insertCategoryWithTask(user, task)
	_ = catID

	result, err := s.handler.HandleStartTimeNotifications()
	s.NoError(err)
	s.Equal(1, result["notifications_sent"])

	// Verify push notification was sent with correct data
	notifications := s.GetSentPushNotifications()
	s.Len(notifications, 1)
	s.Equal(user.PushToken, notifications[0].Token)
	s.Equal("live_activity", notifications[0].Data["type"])
	s.Equal("activeTask", notifications[0].Data["liveActivityType"])
	s.Equal(taskID.Hex(), notifications[0].Data["taskId"])
	s.Equal("Start this task", notifications[0].Data["taskName"])
	s.Equal("Test Workspace", notifications[0].Data["workspaceName"])
}

func (s *LiveActivityTestSuite) TestHandleStartTimeNotifications_NoTasksNoNotifications() {
	// No tasks inserted — should send nothing
	result, err := s.handler.HandleStartTimeNotifications()
	s.NoError(err)
	s.Equal(0, result["notifications_sent"])
	s.AssertPushNotificationCount(0)
}

func (s *LiveActivityTestSuite) TestHandleStartTimeNotifications_SkipsUserWithoutPushToken() {
	user := s.GetUser(0)
	now := xutils.NowUTC()
	startTime := now.Add(-30 * time.Second)

	// Clear the user's push token
	_, err := s.Collections["users"].UpdateOne(s.Ctx,
		bson.M{"_id": user.ID},
		bson.M{"$set": bson.M{"push_token": ""}},
	)
	s.NoError(err)

	taskID := primitive.NewObjectID()
	task := TaskDocument{
		ID:        taskID,
		UserID:    user.ID,
		Content:   "No token task",
		Priority:  1,
		Value:     5.0,
		Active:    true,
		StartTime: &startTime,
		Timestamp: now,
	}
	s.insertCategoryWithTask(user, task)

	result, err := s.handler.HandleStartTimeNotifications()
	s.NoError(err)
	s.Equal(0, result["notifications_sent"])
	s.AssertPushNotificationCount(0)
}

func (s *LiveActivityTestSuite) TestHandleStartTimeNotifications_IncludesEndTimeWhenDeadlineSet() {
	user := s.GetUser(0)
	now := xutils.NowUTC()
	startTime := now.Add(-30 * time.Second)
	deadline := now.Add(2 * time.Hour)

	taskID := primitive.NewObjectID()
	task := TaskDocument{
		ID:        taskID,
		UserID:    user.ID,
		Content:   "Task with deadline",
		Priority:  2,
		Value:     5.0,
		Active:    true,
		StartTime: &startTime,
		Deadline:  &deadline,
		Timestamp: now,
	}
	s.insertCategoryWithTask(user, task)

	result, err := s.handler.HandleStartTimeNotifications()
	s.NoError(err)
	s.Equal(1, result["notifications_sent"])

	notifications := s.GetSentPushNotifications()
	s.Len(notifications, 1)
	s.NotEmpty(notifications[0].Data["endTime"], "endTime should be set when task has a deadline")
	s.NotEmpty(notifications[0].Data["startTime"], "startTime should be set")
}

func (s *LiveActivityTestSuite) TestHandleStartTimeNotifications_EmptyEndTimeWhenNoDeadline() {
	user := s.GetUser(0)
	now := xutils.NowUTC()
	startTime := now.Add(-30 * time.Second)

	taskID := primitive.NewObjectID()
	task := TaskDocument{
		ID:        taskID,
		UserID:    user.ID,
		Content:   "Open-ended task",
		Priority:  1,
		Value:     5.0,
		Active:    true,
		StartTime: &startTime,
		Timestamp: now,
	}
	s.insertCategoryWithTask(user, task)

	result, err := s.handler.HandleStartTimeNotifications()
	s.NoError(err)
	s.Equal(1, result["notifications_sent"])

	notifications := s.GetSentPushNotifications()
	s.Equal("", notifications[0].Data["endTime"], "endTime should be empty when no deadline")
}

// ========================================
// HandleDeadlineApproachingNotifications Tests
// ========================================

func (s *LiveActivityTestSuite) TestHandleDeadlineApproachingNotifications_SendsNotification() {
	user := s.GetUser(0)
	now := xutils.NowUTC()
	deadline := now.Add(60 * time.Minute)

	taskID := primitive.NewObjectID()
	task := TaskDocument{
		ID:        taskID,
		UserID:    user.ID,
		Content:   "Deadline approaching task",
		Priority:  3,
		Value:     8.0,
		Active:    true,
		Deadline:  &deadline,
		Timestamp: now,
	}
	s.insertCategoryWithTask(user, task)

	result, err := s.handler.HandleDeadlineApproachingNotifications()
	s.NoError(err)
	s.Equal(1, result["notifications_sent"])

	notifications := s.GetSentPushNotifications()
	s.Len(notifications, 1)
	s.Equal(user.PushToken, notifications[0].Token)
	s.Equal("live_activity", notifications[0].Data["type"])
	s.Equal("deadlineCountdown", notifications[0].Data["liveActivityType"])
	s.Equal(taskID.Hex(), notifications[0].Data["taskId"])
	s.Equal("Deadline approaching task", notifications[0].Data["taskName"])
	s.Equal("Test Workspace", notifications[0].Data["workspaceName"])
	s.Equal("3", notifications[0].Data["priority"])
}

func (s *LiveActivityTestSuite) TestHandleDeadlineApproachingNotifications_NoTasksNoNotifications() {
	result, err := s.handler.HandleDeadlineApproachingNotifications()
	s.NoError(err)
	s.Equal(0, result["notifications_sent"])
	s.AssertPushNotificationCount(0)
}

func (s *LiveActivityTestSuite) TestHandleDeadlineApproachingNotifications_IgnoresNearDeadline() {
	user := s.GetUser(0)
	now := xutils.NowUTC()
	deadline := now.Add(10 * time.Minute) // 10 min away — not in the 59-61 min window

	taskID := primitive.NewObjectID()
	task := TaskDocument{
		ID:        taskID,
		UserID:    user.ID,
		Content:   "Imminent deadline",
		Priority:  3,
		Value:     5.0,
		Active:    true,
		Deadline:  &deadline,
		Timestamp: now,
	}
	s.insertCategoryWithTask(user, task)

	result, err := s.handler.HandleDeadlineApproachingNotifications()
	s.NoError(err)
	s.Equal(0, result["notifications_sent"], "should not notify for deadlines within 59 minutes")
}

// ========================================
// Multiple Tasks Tests
// ========================================

func (s *LiveActivityTestSuite) TestHandleStartTimeNotifications_MultipleTasksMultipleNotifications() {
	user := s.GetUser(0)
	now := xutils.NowUTC()
	startTime1 := now.Add(-30 * time.Second)
	startTime2 := now.Add(-60 * time.Second)

	// Insert two tasks in the same category
	categoryID := primitive.NewObjectID()
	category := &types.CategoryDocument{
		ID:            categoryID,
		Name:          "Multi Category",
		User:          user.ID,
		WorkspaceName: "Work",
		Tasks: []TaskDocument{
			{
				ID:        primitive.NewObjectID(),
				UserID:    user.ID,
				Content:   "Task 1",
				Priority:  1,
				Value:     5.0,
				Active:    true,
				StartTime: &startTime1,
				Timestamp: now,
			},
			{
				ID:        primitive.NewObjectID(),
				UserID:    user.ID,
				Content:   "Task 2",
				Priority:  2,
				Value:     5.0,
				Active:    true,
				StartTime: &startTime2,
				Timestamp: now,
			},
		},
	}
	_, err := s.Collections["categories"].InsertOne(s.Ctx, category)
	s.NoError(err)

	result, err := s.handler.HandleStartTimeNotifications()
	s.NoError(err)
	s.Equal(2, result["notifications_sent"])
	s.AssertPushNotificationCount(2)
}
