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
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// CheckinSchedule defines the time-to-message and title mapping for daily checkins
// Times are specific moments in the day (hour:minute format)
type CheckinInfo struct {
	Title    string // Title template with %s for user display name
	Message  string // Message template with %d for scheduled tasks, %d for deadline tasks
	SendTask bool   // Whether to send a task with the checkin
}

var CheckinSchedule = map[time.Time]CheckinInfo{
	time.Date(0, 1, 1, 13+4, 1, 0, 0, time.UTC): {
		Title:    "Afternoon Check-in 🌙",
		Message:  "Hey %s, time to review the tasks you have scheduled!",
		SendTask: false,
	},
}

func (h *Handler) HandleCheckin() (fiber.Map, error) {
	// Get current time in UTC
	now := time.Now().UTC()

	// Create a time key for comparison (using only hour and minute, ignoring date)
	currentTimeKey := time.Date(0, 1, 1, now.Hour(), now.Minute(), 0, 0, time.UTC)

	// Check if current time matches any checkin time
	checkinInfo, exists := CheckinSchedule[currentTimeKey]
	if !exists {
		return fiber.Map{
			"message":      "No checkin scheduled for this time",
			"current_time": now.Format("15:04"),
		}, nil
	}

	// Get all users with push tokens
	users, err := h.service.GetUsersWithPushTokens()
	if err != nil {
		slog.Error("Error getting users with push tokens", "error", err)
		return fiber.Map{
			"error": err.Error(),
		}, err
	}

	if len(users) == 0 {
		return fiber.Map{
			"message":      "No users with push tokens found",
			"current_time": now.Format("15:04"),
		}, nil
	}

	// Prepare notifications for batch sending
	notifications := make([]xutils.Notification, 0, len(users))
	for _, user := range users {
		// Skip users without push tokens (extra safety check)
		if user.PushToken == "" {
			continue
		}

		// Get task counts for this user
		taskCounts, err := h.service.GetUserTaskCountsForToday(user.ID)
		if err != nil {
			slog.Error("Error getting task counts for user", "user_id", user.ID, "error", err)
			// Continue with zero counts if there's an error
			taskCounts = &TaskCounts{ScheduledToday: 0, DeadlineToday: 0}
		}

		// Personalize the message with the user's display name
		personalizedMessage := fmt.Sprintf(checkinInfo.Message, user.DisplayName)

		notifications = append(notifications, xutils.Notification{
			Token:   user.PushToken,
			Message: personalizedMessage,
			Title:   checkinInfo.Title,
			Data: map[string]string{
				"type":            "checkin",
				"time":            now.Format("15:04"),
				"timestamp":       now.Format(time.RFC3339),
				"scheduled_today": fmt.Sprintf("%d", taskCounts.ScheduledToday),
				"deadline_today":  fmt.Sprintf("%d", taskCounts.DeadlineToday),
				"url":             "/(logged-in)/(tabs)/(task)/review",
			},
		})
	}

	// Send batch notifications
	if len(notifications) > 0 {
		err = xutils.SendBatchNotification(notifications)
		if err != nil {
			slog.Error("Error sending batch checkin notifications", "error", err)
			return fiber.Map{
				"error":              err.Error(),
				"users_targeted":     len(users),
				"notifications_sent": 0,
				"current_time":       now.Format("15:04"),
				"title_template":     checkinInfo.Title,
				"message_template":   checkinInfo.Message,
			}, err
		}

		slog.Info("Checkin notifications sent successfully",
			"users_count", len(notifications),
			"time", now.Format("15:04"),
			"title_template", checkinInfo.Title,
			"message_template", checkinInfo.Message)
	}

	return fiber.Map{
		"message":            "Checkin notifications sent successfully",
		"users_targeted":     len(users),
		"notifications_sent": len(notifications),
		"current_time":       now.Format("15:04"),
		"title_template":     checkinInfo.Title,
		"message_template":   checkinInfo.Message,
	}, nil
}

// TaskCounts represents the count of tasks for a user
type TaskCounts struct {
	ScheduledToday int
	DeadlineToday  int
}

// GetUserTaskCountsForToday returns the count of tasks on deck (start date before today) and due today for a specific user
func (s *Service) GetUserTaskCountsForToday(userID primitive.ObjectID) (*TaskCounts, error) {
	ctx := context.Background()

	// Get today's date range (start and end of day in UTC)
	now := time.Now().UTC()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	endOfDay := time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 999999999, time.UTC)

	// Pipeline to find tasks for the user and count on deck and deadline tasks
	pipeline := []bson.M{
		{
			"$match": bson.M{"user": userID},
		},
		{
			"$unwind": "$tasks",
		},
		{
			"$group": bson.M{
				"_id": nil,
				"scheduledToday": bson.M{
					"$sum": bson.M{
						"$cond": []interface{}{
							bson.M{
								"$and": []bson.M{
									{"$ne": []interface{}{"$tasks.startDate", nil}},
									{"$lt": []interface{}{"$tasks.startDate", startOfDay}}, // Tasks with start date before today
								},
							},
							1,
							0,
						},
					},
				},
				"deadlineToday": bson.M{
					"$sum": bson.M{
						"$cond": []interface{}{
							bson.M{
								"$and": []bson.M{
									{"$ne": []interface{}{"$tasks.deadline", nil}},
									{"$gte": []interface{}{"$tasks.deadline", startOfDay}},
									{"$lte": []interface{}{"$tasks.deadline", endOfDay}},
								},
							},
							1,
							0,
						},
					},
				},
			},
		},
	}

	cursor, err := s.Tasks.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, fmt.Errorf("failed to aggregate task counts: %w", err)
	}
	defer cursor.Close(ctx)

	var result struct {
		ScheduledToday int `bson:"scheduledToday"`
		DeadlineToday  int `bson:"deadlineToday"`
	}

	if cursor.Next(ctx) {
		if err := cursor.Decode(&result); err != nil {
			return nil, fmt.Errorf("failed to decode task counts: %w", err)
		}
	}

	return &TaskCounts{
		ScheduledToday: result.ScheduledToday,
		DeadlineToday:  result.DeadlineToday,
	}, nil
}

// GetUsersWithPushTokens retrieves all users that have push tokens for notifications
func (s *Service) GetUsersWithPushTokens() ([]types.User, error) {
	ctx := context.Background()

	// Find users that have non-empty push tokens
	filter := bson.M{
		"push_token": bson.M{
			"$exists": true,
			"$ne":     "",
		},
	}

	// Only select the fields we need for notifications
	projection := bson.M{
		"_id":          1,
		"push_token":   1,
		"display_name": 1,
	}

	cursor, err := s.Users.Find(ctx, filter, &options.FindOptions{
		Projection: projection,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to query users with push tokens: %w", err)
	}
	defer cursor.Close(ctx)

	var users []types.User
	if err := cursor.All(ctx, &users); err != nil {
		return nil, fmt.Errorf("failed to decode users: %w", err)
	}

	return users, nil
}
