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
