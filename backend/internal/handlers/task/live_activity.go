package task

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/xutils"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
)

// GetTasksWithStartTimeInWindow returns active, incomplete tasks whose startTime falls within the given window.
func (s *Service) GetTasksWithStartTimeInWindow(windowStart, windowEnd time.Time) ([]TaskDocument, error) {
	ctx := context.Background()

	pipeline := getBaseTaskPipeline()
	pipeline = append(pipeline, bson.D{{Key: "$match", Value: bson.M{
		"active":        true,
		"timeCompleted": nil,
		"startTime": bson.M{
			"$gte": windowStart,
			"$lte": windowEnd,
		},
	}}})

	cursor, err := s.Tasks.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []TaskDocument
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}
	return results, nil
}

// GetTasksWithDeadlineApproaching returns active, incomplete tasks whose deadline falls within the given window.
func (s *Service) GetTasksWithDeadlineApproaching(windowStart, windowEnd time.Time) ([]TaskDocument, error) {
	ctx := context.Background()

	pipeline := getBaseTaskPipeline()
	pipeline = append(pipeline, bson.D{{Key: "$match", Value: bson.M{
		"active":        true,
		"timeCompleted": nil,
		"deadline": bson.M{
			"$gte": windowStart,
			"$lte": windowEnd,
		},
	}}})

	cursor, err := s.Tasks.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []TaskDocument
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}
	return results, nil
}

// getCategoryWorkspaceName finds the category document and returns its workspaceName field.
// Defaults to "Tasks" if the category is not found or has no workspace name.
func (s *Service) getCategoryWorkspaceName(categoryID interface{}) string {
	ctx := context.Background()

	var category types.CategoryDocument
	err := s.Tasks.FindOne(ctx, bson.M{"_id": categoryID}).Decode(&category)
	if err != nil {
		return "Tasks"
	}
	if category.WorkspaceName == "" {
		return "Tasks"
	}
	return category.WorkspaceName
}

// HandleStartTimeNotifications sends live activity push notifications for tasks whose startTime
// falls within a 2-minute window ending at now.
func (h *Handler) HandleStartTimeNotifications() (fiber.Map, error) {
	now := xutils.NowUTC()
	windowStart := now.Add(-2 * time.Minute)
	windowEnd := now

	tasks, err := h.service.GetTasksWithStartTimeInWindow(windowStart, windowEnd)
	if err != nil {
		slog.Error("Error getting tasks with start time in window", "error", err)
		return fiber.Map{
			"error": err.Error(),
		}, err
	}

	notificationsSent := 0
	for _, task := range tasks {
		ctx := context.Background()
		user, err := h.service.Users.GetUserByID(ctx, task.UserID)
		if err != nil {
			slog.Error("Failed to get user for start-time notification", "error", err, "userId", task.UserID.Hex())
			continue
		}

		if user.PushToken == "" {
			slog.Warn("User has no push token, skipping start-time notification", "user_id", task.UserID.Hex())
			continue
		}

		workspaceName := h.service.getCategoryWorkspaceName(task.CategoryID)

		endTime := ""
		if task.Deadline != nil {
			endTime = task.Deadline.Format(time.RFC3339)
		}

		startTime := ""
		if task.StartTime != nil {
			startTime = task.StartTime.Format(time.RFC3339)
		}

		err = xutils.SendNotification(xutils.Notification{
			Token:   user.PushToken,
			Message: fmt.Sprintf("Time to start: %s", task.Content),
			Title:   workspaceName,
			Data: map[string]string{
				"type":             "live_activity",
				"liveActivityType": "activeTask",
				"taskId":           task.ID.Hex(),
				"categoryId":       task.CategoryID.Hex(),
				"taskName":         task.Content,
				"workspaceName":    workspaceName,
				"startTime":        startTime,
				"endTime":          endTime,
			},
		})
		if err != nil {
			slog.Error("Failed to send start-time live activity notification", "error", err, "taskId", task.ID.Hex(), "userId", task.UserID.Hex())
			continue
		}
		notificationsSent++
	}

	return fiber.Map{
		"notifications_sent": notificationsSent,
		"tasks_matched":      len(tasks),
	}, nil
}

// HandleDeadlineApproachingNotifications sends live activity push notifications for tasks whose
// deadline is approximately 1 hour away (59-61 minute window from now).
func (h *Handler) HandleDeadlineApproachingNotifications() (fiber.Map, error) {
	now := xutils.NowUTC()
	windowStart := now.Add(59 * time.Minute)
	windowEnd := now.Add(61 * time.Minute)

	tasks, err := h.service.GetTasksWithDeadlineApproaching(windowStart, windowEnd)
	if err != nil {
		slog.Error("Error getting tasks with deadline approaching", "error", err)
		return fiber.Map{
			"error": err.Error(),
		}, err
	}

	notificationsSent := 0
	for _, task := range tasks {
		ctx := context.Background()
		user, err := h.service.Users.GetUserByID(ctx, task.UserID)
		if err != nil {
			slog.Error("Failed to get user for deadline notification", "error", err, "userId", task.UserID.Hex())
			continue
		}

		if user.PushToken == "" {
			slog.Warn("User has no push token, skipping deadline notification", "user_id", task.UserID.Hex())
			continue
		}

		workspaceName := h.service.getCategoryWorkspaceName(task.CategoryID)

		deadline := ""
		if task.Deadline != nil {
			deadline = task.Deadline.Format(time.RFC3339)
		}

		err = xutils.SendNotification(xutils.Notification{
			Token:   user.PushToken,
			Message: fmt.Sprintf("Deadline in 1 hour: %s", task.Content),
			Title:   workspaceName,
			Data: map[string]string{
				"type":             "live_activity",
				"liveActivityType": "deadlineCountdown",
				"taskId":           task.ID.Hex(),
				"categoryId":       task.CategoryID.Hex(),
				"taskName":         task.Content,
				"workspaceName":    workspaceName,
				"deadline":         deadline,
				"priority":         fmt.Sprintf("%d", task.Priority),
			},
		})
		if err != nil {
			slog.Error("Failed to send deadline live activity notification", "error", err, "taskId", task.ID.Hex(), "userId", task.UserID.Hex())
			continue
		}
		notificationsSent++
	}

	return fiber.Map{
		"notifications_sent": notificationsSent,
		"tasks_matched":      len(tasks),
	}, nil
}
