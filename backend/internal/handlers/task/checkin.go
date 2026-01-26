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
// Times are in local time (hour:minute format) and will be checked against each user's timezone
type CheckinInfo struct {
	Title    string // Title template with %s for user display name
	Message  string // Message template with %d for scheduled tasks, %d for deadline tasks
	SendTask bool   // Whether to send a task with the checkin
	Hour     int    // Hour in user's local time (0-23)
	Minute   int    // Minute in user's local time (0-59)
}

var CheckinTimes = []CheckinInfo{
	{
		Title:    "Afternoon Check-in 🌙",
		Message:  "Hey %s, time to review the tasks you have scheduled!",
		SendTask: false,
		Hour:     17, // 5 PM local time
		Minute:   1,
	},
}

func (h *Handler) HandleCheckin() (fiber.Map, error) {
	// Get current time in UTC
	nowUTC := time.Now().UTC()

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
			"current_time": nowUTC.Format("15:04"),
		}, nil
	}

	// Prepare notifications for users whose local time matches a check-in time
	notifications := make([]xutils.Notification, 0)
	skippedCount := 0
	totalMatched := 0

	for _, user := range users {
		// Skip if user has disabled check-ins
		frequency := user.Settings.Notifications.CheckinFrequency
		if frequency == "none" {
			skippedCount++
			continue
		}

		// Get user's timezone, default to UTC if not set
		userTimezone := user.Timezone
		if userTimezone == "" {
			userTimezone = "UTC"
		}

		// Load user's timezone location
		loc, err := time.LoadLocation(userTimezone)
		if err != nil {
			slog.Warn("Invalid timezone for user, defaulting to UTC",
				"user_id", user.ID,
				"timezone", userTimezone,
				"error", err)
			loc = time.UTC
		}

		// Convert current UTC time to user's local time
		userLocalTime := nowUTC.In(loc)
		userHour := userLocalTime.Hour()
		userMinute := userLocalTime.Minute()
		userDayOfWeek := userLocalTime.Weekday()

		// Check if current time matches any check-in time for this user
		var matchedCheckin *CheckinInfo
		for i := range CheckinTimes {
			checkin := &CheckinTimes[i]
			if checkin.Hour == userHour && checkin.Minute == userMinute {
				matchedCheckin = checkin
				break
			}
		}

		if matchedCheckin == nil {
			// No check-in scheduled for this user at this time
			continue
		}

		// Apply frequency-based filtering
		shouldNotify := false
		switch frequency {
		case "occasionally": // 1-2x per week (Monday, Thursday)
			shouldNotify = userDayOfWeek == time.Monday || userDayOfWeek == time.Thursday
		case "regularly": // 3-4x per week (Mon, Wed, Fri, Sun)
			shouldNotify = userDayOfWeek == time.Monday || userDayOfWeek == time.Wednesday ||
				userDayOfWeek == time.Friday || userDayOfWeek == time.Sunday
		case "frequently": // Daily
			shouldNotify = true
		default:
			// Default to regularly if invalid value
			shouldNotify = userDayOfWeek == time.Monday || userDayOfWeek == time.Wednesday ||
				userDayOfWeek == time.Friday || userDayOfWeek == time.Sunday
		}

		if !shouldNotify {
			skippedCount++
			continue
		}

		totalMatched++

		// Skip users without push tokens (extra safety check)
		if user.PushToken == "" {
			continue
		}

		// Get task counts for this user using their timezone
		taskCounts, err := h.service.GetUserTaskCountsForTodayWithTimezone(user.ID, loc)
		if err != nil {
			slog.Error("Error getting task counts for user", "user_id", user.ID, "error", err)
			// Continue with zero counts if there's an error
			taskCounts = &TaskCounts{ScheduledToday: 0, DeadlineToday: 0}
		}

		// Personalize the message with the user's display name
		personalizedMessage := fmt.Sprintf(matchedCheckin.Message, user.DisplayName)

		notifications = append(notifications, xutils.Notification{
			Token:   user.PushToken,
			Message: personalizedMessage,
			Title:   matchedCheckin.Title,
			Data: map[string]string{
				"type":            "checkin",
				"time":            userLocalTime.Format("15:04"),
				"timestamp":       userLocalTime.Format(time.RFC3339),
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
				"current_time":       nowUTC.Format("15:04"),
			}, err
		}

		slog.Info("Checkin notifications sent successfully",
			"users_count", len(notifications),
			"time", nowUTC.Format("15:04"))
	}

	return fiber.Map{
		"message":            "Checkin notifications processed",
		"total_users":        len(users),
		"matched_users":      totalMatched,
		"skipped_users":      skippedCount,
		"notifications_sent": len(notifications),
		"current_time":       nowUTC.Format("15:04"),
	}, nil
}

// TaskCounts represents the count of tasks for a user
type TaskCounts struct {
	ScheduledToday int
	DeadlineToday  int
}

// GetUserTaskCountsForTodayWithTimezone returns the count of tasks on deck and due today for a specific user in their timezone
func (s *Service) GetUserTaskCountsForTodayWithTimezone(userID primitive.ObjectID, loc *time.Location) (*TaskCounts, error) {
	ctx := context.Background()

	// Get today's date range in user's timezone
	now := time.Now().In(loc)
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc).UTC()
	endOfDay := time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 999999999, loc).UTC()

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

// GetUserTaskCountsForToday returns the count of tasks on deck (start date before today) and due today for a specific user
// This uses UTC for backward compatibility
func (s *Service) GetUserTaskCountsForToday(userID primitive.ObjectID) (*TaskCounts, error) {
	return s.GetUserTaskCountsForTodayWithTimezone(userID, time.UTC)
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

	// Select the fields we need for notifications including timezone and settings
	projection := bson.M{
		"_id":          1,
		"push_token":   1,
		"display_name": 1,
		"timezone":     1,
		"settings":     1,
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
