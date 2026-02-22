package task

import (
	"log/slog"
	"testing"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	testpkg "github.com/abhikaboy/Kindred/internal/testing"
	"github.com/abhikaboy/Kindred/xutils"
	"github.com/stretchr/testify/suite"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// TaskServiceTestSuite is the test suite for task service
type TaskServiceTestSuite struct {
	testpkg.BaseSuite
	service *Service
}

// SetupTest runs before each test
func (s *TaskServiceTestSuite) SetupTest() {
	s.BaseSuite.SetupTest()
	s.service = NewService(s.Collections)
}

// TestTaskService runs the test suite
func TestTaskService(t *testing.T) {
	suite.Run(t, new(TaskServiceTestSuite))
}

// ========================================
// Template Stats Update Tests
// ========================================

func (s *TaskServiceTestSuite) TestMarkAsCompleted_UpdatesTemplateStats() {
	user := s.GetUser(0)

	// Create a category
	category := &types.CategoryDocument{
		ID:            primitive.NewObjectID(),
		Name:          "Test Category",
		User:          user.ID,
		WorkspaceName: "Test Workspace",
		Tasks:         []TaskDocument{},
	}

	_, err := s.Collections["categories"].InsertOne(s.Ctx, category)
	s.NoError(err)

	// Create a template task
	templateID := primitive.NewObjectID()
	now := xutils.NowUTC()
	nextGen := now.Add(24 * time.Hour) // Next occurrence is tomorrow
	template := &TemplateTaskDocument{
		ID:             templateID,
		UserID:         user.ID,
		CategoryID:     category.ID,
		Content:        "Daily Task",
		Priority:       1,
		Value:          10.0,
		RecurFrequency: "daily",
		RecurType:      "OCCURRENCE",
		RecurDetails: &RecurDetails{
			Every: 1, // Every 1 day
		},
		NextGenerated:   &nextGen,
		TimesCompleted:  0,
		Streak:          0,
		HighestStreak:   0,
		CompletionDates: []time.Time{},
	}

	_, err = s.Collections["template-tasks"].InsertOne(s.Ctx, template)
	s.NoError(err)

	// Create a task linked to the template
	taskID := primitive.NewObjectID()
	task := TaskDocument{
		ID:         taskID,
		UserID:     user.ID,
		CategoryID: category.ID,
		Content:    "Daily Task",
		Priority:   1,
		Value:      10.0,
		TemplateID: &templateID,
		Active:     true,
		Timestamp:  xutils.NowUTC(),
	}

	// Add task to category
	_, err = s.Collections["categories"].UpdateOne(s.Ctx,
		bson.M{"_id": category.ID},
		bson.M{"$push": bson.M{"tasks": task}},
	)
	s.NoError(err)

	// Mark the task as completed
	_, err = s.service.CompleteTask(user.ID, taskID, category.ID, CompleteTaskDocument{
		TimeCompleted: xutils.NowUTC().Format(time.RFC3339),
		TimeTaken:     "PT0S",
	})
	s.NoError(err)

	// Verify template stats were updated
	var updatedTemplate TemplateTaskDocument
	err = s.Collections["template-tasks"].FindOne(s.Ctx, bson.M{"_id": templateID}).Decode(&updatedTemplate)
	s.NoError(err)

	// Debug: Print template values
	slog.Info("Test verification", "templateID", templateID.Hex(), "timesCompleted", updatedTemplate.TimesCompleted, "streak", updatedTemplate.Streak, "highestStreak", updatedTemplate.HighestStreak)

	// Check that stats were incremented
	s.Equal(1, updatedTemplate.TimesCompleted, "TimesCompleted should be 1")
	s.Equal(1, updatedTemplate.Streak, "Streak should be 1")
	s.Equal(1, updatedTemplate.HighestStreak, "HighestStreak should be 1")
	s.Len(updatedTemplate.CompletionDates, 1, "CompletionDates should have 1 entry")
}

func (s *TaskServiceTestSuite) TestMarkAsCompleted_MultipleCompletions_UpdatesStreakAndHighestStreak() {
	user := s.GetUser(0)

	// Create a category
	category := &types.CategoryDocument{
		ID:            primitive.NewObjectID(),
		Name:          "Test Category",
		User:          user.ID,
		WorkspaceName: "Test Workspace",
		Tasks:         []TaskDocument{},
	}

	_, err := s.Collections["categories"].InsertOne(s.Ctx, category)
	s.NoError(err)

	// Create a template task with existing stats
	templateID := primitive.NewObjectID()
	now := xutils.NowUTC()
	nextGen := now.Add(24 * time.Hour) // Next occurrence is tomorrow
	template := &types.TemplateTaskDocument{
		ID:             templateID,
		UserID:         user.ID,
		CategoryID:     category.ID,
		Content:        "Daily Task",
		Priority:       1,
		Value:          10.0,
		RecurFrequency: "daily",
		RecurType:      "OCCURRENCE",
		RecurDetails: &types.RecurDetails{
			Every: 1, // Every 1 day
		},
		NextGenerated:   &nextGen,
		TimesCompleted:  2,
		Streak:          2,
		HighestStreak:   5, // Previous highest was 5
		CompletionDates: []time.Time{xutils.NowUTC().AddDate(0, 0, -2), xutils.NowUTC().AddDate(0, 0, -1)},
	}

	_, err = s.Collections["template-tasks"].InsertOne(s.Ctx, template)
	s.NoError(err)

	// Create a task linked to the template
	taskID := primitive.NewObjectID()
	task := TaskDocument{
		ID:         taskID,
		UserID:     user.ID,
		CategoryID: category.ID,
		Content:    "Daily Task",
		Priority:   1,
		Value:      10.0,
		TemplateID: &templateID,
		Active:     true,
		Timestamp:  xutils.NowUTC(),
	}

	// Add task to category
	_, err = s.Collections["categories"].UpdateOne(s.Ctx,
		bson.M{"_id": category.ID},
		bson.M{"$push": bson.M{"tasks": task}},
	)
	s.NoError(err)

	// Mark the task as completed
	_, err = s.service.CompleteTask(user.ID, taskID, category.ID, CompleteTaskDocument{
		TimeCompleted: xutils.NowUTC().Format(time.RFC3339),
		TimeTaken:     "PT0S",
	})
	s.NoError(err)

	// Verify template stats were updated
	var updatedTemplate TemplateTaskDocument
	err = s.Collections["template-tasks"].FindOne(s.Ctx, bson.M{"_id": templateID}).Decode(&updatedTemplate)
	s.NoError(err)

	// Check that stats were incremented
	s.Equal(3, updatedTemplate.TimesCompleted, "TimesCompleted should be 3")
	s.Equal(3, updatedTemplate.Streak, "Streak should be 3")
	s.Equal(5, updatedTemplate.HighestStreak, "HighestStreak should remain 5 (not exceeded)")
	s.Len(updatedTemplate.CompletionDates, 3, "CompletionDates should have 3 entries")
}

func (s *TaskServiceTestSuite) TestMarkAsCompleted_ExceedsHighestStreak() {
	user := s.GetUser(0)

	// Create a category
	category := &types.CategoryDocument{
		ID:            primitive.NewObjectID(),
		Name:          "Test Category",
		User:          user.ID,
		WorkspaceName: "Test Workspace",
		Tasks:         []TaskDocument{},
	}

	_, err := s.Collections["categories"].InsertOne(s.Ctx, category)
	s.NoError(err)

	// Create a template task with streak about to exceed highest
	templateID := primitive.NewObjectID()
	now := xutils.NowUTC()
	nextGen := now.Add(24 * time.Hour) // Next occurrence is tomorrow
	template := &types.TemplateTaskDocument{
		ID:             templateID,
		UserID:         user.ID,
		CategoryID:     category.ID,
		Content:        "Daily Task",
		Priority:       1,
		Value:          10.0,
		RecurFrequency: "daily",
		RecurType:      "OCCURRENCE",
		RecurDetails: &types.RecurDetails{
			Every: 1, // Every 1 day
		},
		NextGenerated:   &nextGen,
		TimesCompleted:  4,
		Streak:          4,
		HighestStreak:   4,
		CompletionDates: []time.Time{},
	}

	_, err = s.Collections["template-tasks"].InsertOne(s.Ctx, template)
	s.NoError(err)

	// Create a task linked to the template
	taskID := primitive.NewObjectID()
	task := TaskDocument{
		ID:         taskID,
		UserID:     user.ID,
		CategoryID: category.ID,
		Content:    "Daily Task",
		Priority:   1,
		Value:      10.0,
		TemplateID: &templateID,
		Active:     true,
		Timestamp:  xutils.NowUTC(),
	}

	// Add task to category
	_, err = s.Collections["categories"].UpdateOne(s.Ctx,
		bson.M{"_id": category.ID},
		bson.M{"$push": bson.M{"tasks": task}},
	)
	s.NoError(err)

	// Mark the task as completed
	_, err = s.service.CompleteTask(user.ID, taskID, category.ID, CompleteTaskDocument{
		TimeCompleted: xutils.NowUTC().Format(time.RFC3339),
		TimeTaken:     "PT0S",
	})
	s.NoError(err)

	// Verify template stats were updated
	var updatedTemplate TemplateTaskDocument
	err = s.Collections["template-tasks"].FindOne(s.Ctx, bson.M{"_id": templateID}).Decode(&updatedTemplate)
	s.NoError(err)

	// Check that stats were incremented and highest streak was updated
	s.Equal(5, updatedTemplate.TimesCompleted, "TimesCompleted should be 5")
	s.Equal(5, updatedTemplate.Streak, "Streak should be 5")
	s.Equal(5, updatedTemplate.HighestStreak, "HighestStreak should be updated to 5")
	s.Len(updatedTemplate.CompletionDates, 1, "CompletionDates should have 1 entry")
}

func (s *TaskServiceTestSuite) TestMarkAsCompleted_NonRecurringTask_DoesNotUpdateTemplate() {
	user := s.GetUser(0)

	// Create a category
	category := &types.CategoryDocument{
		ID:            primitive.NewObjectID(),
		Name:          "Test Category",
		User:          user.ID,
		WorkspaceName: "Test Workspace",
		Tasks:         []TaskDocument{},
	}

	_, err := s.Collections["categories"].InsertOne(s.Ctx, category)
	s.NoError(err)

	// Create a non-recurring task (no templateID)
	taskID := primitive.NewObjectID()
	task := types.TaskDocument{
		ID:         taskID,
		UserID:     user.ID,
		CategoryID: category.ID,
		Content:    "One-time Task",
		Priority:   1,
		Value:      10.0,
		TemplateID: nil, // No template
		Active:     true,
		Timestamp:  xutils.NowUTC(),
	}

	// Add task to category
	_, err = s.Collections["categories"].UpdateOne(s.Ctx,
		bson.M{"_id": category.ID},
		bson.M{"$push": bson.M{"tasks": task}},
	)
	s.NoError(err)

	// Mark the task as completed
	_, err = s.service.CompleteTask(user.ID, taskID, category.ID, CompleteTaskDocument{
		TimeCompleted: xutils.NowUTC().Format(time.RFC3339),
		TimeTaken:     "PT0S",
	})
	s.NoError(err)

	// Verify no templates exist (this is a non-recurring task)
	count, err := s.Collections["template-tasks"].CountDocuments(s.Ctx, bson.M{})
	s.NoError(err)
	s.Equal(int64(0), count, "No templates should exist for non-recurring tasks")
}

// ========================================
// Create Template For Task Tests
// ========================================

// TestCreateTemplateForTask_WindowType_WeeklyTuesdayRecurrence_ReturnsError documents a bug
// where creating a recurring task with both a start date and a deadline (WINDOW type) fails.
// CreateTemplateForTask correctly sets RecurType="WINDOW" but then calls ComputeNextOccurrence,
// which rejects any template whose RecurType is not "OCCURRENCE", causing an error.
func (s *TaskServiceTestSuite) TestCreateTemplateForTask_WindowType_WeeklyTuesdayRecurrence_ReturnsError() {
	user := s.GetUser(0)

	// Create a category
	category := &types.CategoryDocument{
		ID:            primitive.NewObjectID(),
		Name:          "Test Category",
		User:          user.ID,
		WorkspaceName: "Test Workspace",
		Tasks:         []TaskDocument{},
	}
	_, err := s.Collections["categories"].InsertOne(s.Ctx, category)
	s.NoError(err)

	// Start date/time: Tuesday Feb 24, 2026 at 10:00 AM UTC
	// DaysOfWeek is indexed: Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6
	startDate := time.Date(2026, 2, 24, 10, 0, 0, 0, time.UTC)

	// Deadline: 4 hours later on the same Tuesday
	deadline := startDate.Add(4 * time.Hour) // 2:00 PM UTC

	// Recur every Tuesday
	recurDetails := &RecurDetails{
		Every:      1,
		DaysOfWeek: []int{0, 0, 1, 0, 0, 0, 0}, // index 2 = Tuesday
		Behavior:   "ROLLING",
	}

	templateID := primitive.NewObjectID()

	// Having both startDate and deadline causes recurType="WINDOW" in CreateTemplateForTask.
	// ComputeNextWindow handles WINDOW type by using startDate as the time-of-day source.
	err = s.service.CreateTemplateForTask(
		user.ID,
		category.ID,
		templateID,
		"Tuesday Recurring Task",
		1,    // priority
		10.0, // value
		false,
		"weekly",
		recurDetails,
		&deadline,  // deadline set
		nil,        // startTime
		&startDate, // startDate set — combined with deadline → WINDOW type
		nil,        // reminders
	)

	s.NoError(err, "Creating a WINDOW-type recurring task should succeed")

	// Verify the template was persisted
	var storedTemplate TemplateTaskDocument
	findErr := s.Collections["template-tasks"].FindOne(s.Ctx, bson.M{"_id": templateID}).Decode(&storedTemplate)
	s.NoError(findErr)

	s.Equal("WINDOW", storedTemplate.RecurType, "Template should have WINDOW recur type")
	s.NotNil(storedTemplate.NextGenerated, "NextGenerated should be set")

	// NextGenerated should be a Tuesday (the next occurrence of the window's start)
	s.Equal(time.Tuesday, storedTemplate.NextGenerated.Weekday(), "Next occurrence should land on a Tuesday")

	// NextGenerated should carry the start time-of-day (10:00 AM UTC)
	s.Equal(10, storedTemplate.NextGenerated.Hour(), "Next occurrence should be at 10:00 AM UTC")
	s.Equal(0, storedTemplate.NextGenerated.Minute())
}

func (s *TaskServiceTestSuite) TestBulkMarkAsCompleted_UpdatesMultipleTemplates() {
	user := s.GetUser(0)

	// Create a category
	category := &types.CategoryDocument{
		ID:            primitive.NewObjectID(),
		Name:          "Test Category",
		User:          user.ID,
		WorkspaceName: "Test Workspace",
		Tasks:         []TaskDocument{},
	}

	_, err := s.Collections["categories"].InsertOne(s.Ctx, category)
	s.NoError(err)

	// Create two template tasks
	templateID1 := primitive.NewObjectID()
	template1 := &types.TemplateTaskDocument{
		ID:              templateID1,
		UserID:          user.ID,
		CategoryID:      category.ID,
		Content:         "Daily Task 1",
		Priority:        1,
		Value:           10.0,
		RecurFrequency:  "daily",
		RecurType:       "OCCURRENCE",
		TimesCompleted:  0,
		Streak:          0,
		HighestStreak:   0,
		CompletionDates: []time.Time{},
	}

	templateID2 := primitive.NewObjectID()
	template2 := &types.TemplateTaskDocument{
		ID:              templateID2,
		UserID:          user.ID,
		CategoryID:      category.ID,
		Content:         "Daily Task 2",
		Priority:        2,
		Value:           15.0,
		RecurFrequency:  "daily",
		RecurType:       "OCCURRENCE",
		TimesCompleted:  0,
		Streak:          0,
		HighestStreak:   0,
		CompletionDates: []time.Time{},
	}

	_, err = s.Collections["template-tasks"].InsertMany(s.Ctx, []interface{}{template1, template2})
	s.NoError(err)

	// Create tasks linked to the templates
	taskID1 := primitive.NewObjectID()
	task1 := types.TaskDocument{
		ID:         taskID1,
		UserID:     user.ID,
		CategoryID: category.ID,
		Content:    "Daily Task 1",
		Priority:   1,
		Value:      10.0,
		TemplateID: &templateID1,
		Active:     true,
		Timestamp:  xutils.NowUTC(),
	}

	taskID2 := primitive.NewObjectID()
	task2 := types.TaskDocument{
		ID:         taskID2,
		UserID:     user.ID,
		CategoryID: category.ID,
		Content:    "Daily Task 2",
		Priority:   2,
		Value:      15.0,
		TemplateID: &templateID2,
		Active:     true,
		Timestamp:  xutils.NowUTC(),
	}

	// Add tasks to category
	_, err = s.Collections["categories"].UpdateOne(s.Ctx,
		bson.M{"_id": category.ID},
		bson.M{"$push": bson.M{"tasks": bson.M{"$each": []TaskDocument{task1, task2}}}},
	)
	s.NoError(err)

	// Bulk mark tasks as completed
	completionData := []BulkCompleteTaskItem{
		{
			CategoryID: category.ID.Hex(),
			TaskID:     taskID1.Hex(),
			CompleteData: CompleteTaskDocument{
				TimeCompleted: xutils.NowUTC().Format(time.RFC3339),
				TimeTaken:     "PT0S",
			},
		},
		{
			CategoryID: category.ID.Hex(),
			TaskID:     taskID2.Hex(),
			CompleteData: CompleteTaskDocument{
				TimeCompleted: xutils.NowUTC().Format(time.RFC3339),
				TimeTaken:     "PT0S",
			},
		},
	}

	_, err = s.service.BulkCompleteTask(user.ID, completionData)
	s.NoError(err)

	// Verify both templates were updated
	var updatedTemplate1 types.TemplateTaskDocument
	err = s.Collections["template-tasks"].FindOne(s.Ctx, bson.M{"_id": templateID1}).Decode(&updatedTemplate1)
	s.NoError(err)
	s.Equal(1, updatedTemplate1.TimesCompleted, "Template 1 TimesCompleted should be 1")
	s.Equal(1, updatedTemplate1.Streak, "Template 1 Streak should be 1")
	s.Len(updatedTemplate1.CompletionDates, 1, "Template 1 should have 1 completion date")

	var updatedTemplate2 types.TemplateTaskDocument
	err = s.Collections["template-tasks"].FindOne(s.Ctx, bson.M{"_id": templateID2}).Decode(&updatedTemplate2)
	s.NoError(err)
	s.Equal(1, updatedTemplate2.TimesCompleted, "Template 2 TimesCompleted should be 1")
	s.Equal(1, updatedTemplate2.Streak, "Template 2 Streak should be 1")
	s.Len(updatedTemplate2.CompletionDates, 1, "Template 2 should have 1 completion date")
}
