package task

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/url"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/xutils"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// userMemoryCollection mirrors gemini.UserMemoryCollection. package gemini
// imports this one, so the name can't be shared without a cycle.
const userMemoryCollection = "user_memory"

// HandleCheckin runs every minute and sends the check-ins that are due. See
// checkin_policy.go for the rules; this gathers the state they need.
func (h *Handler) HandleCheckin() (fiber.Map, error) {
	nowUTC := time.Now().UTC()
	ctx := context.Background()

	users, err := h.service.GetUsersWithPushTokens()
	if err != nil {
		slog.Error("Error getting users with push tokens", "error", err)
		return fiber.Map{"error": err.Error()}, err
	}

	notifications := make([]xutils.Notification, 0)
	skipped := map[CheckinSkip]int{}
	inSlot := 0

	for _, user := range users {
		if user.Settings.Notifications.CheckinFrequency == "none" {
			continue
		}
		loc := checkinLocation(user.Timezone)
		local := nowUTC.In(loc)

		// Cheap gates first: most users are nowhere near their slot this
		// minute, and those never cost a query.
		if local.Minute() != CheckinMinute(user.ID) {
			continue
		}
		if local.Hour() < CheckinEarliestHour || local.Hour() > CheckinLatestHour {
			continue
		}
		peakStart, reduce := h.service.loadCheckinFacts(ctx, user.ID)
		if local.Hour() != CheckinHour(peakStart) {
			continue
		}
		inSlot++

		if user.PushToken == "" {
			skipped[CheckinSkipNoToken]++
			continue
		}

		state, err := h.service.loadCheckinState(ctx, user.ID)
		if err != nil {
			slog.Error("Check-in: failed to load state", "user_id", user.ID, "error", err)
			continue
		}
		candidates, lastEdit, err := h.service.loadCheckinCandidates(ctx, user.ID)
		if err != nil {
			slog.Error("Check-in: failed to load tasks", "user_id", user.ID, "error", err)
			continue
		}
		lastDone, err := h.service.lastCompletionAt(ctx, user.ID)
		if err != nil {
			slog.Error("Check-in: failed to load last completion", "user_id", user.ID, "error", err)
			continue
		}
		state.Frequency = user.Settings.Notifications.CheckinFrequency
		state.ReduceFrequency = reduce
		state.LastActiveAt = latestTime(lastEdit, lastDone)

		if skip := EvaluateCheckin(state, nowUTC, loc); skip != CheckinSend {
			skipped[skip]++
			continue
		}
		focus := PickCheckinFocus(candidates, nowUTC, loc)
		if focus == nil {
			skipped[CheckinSkipNoFocus]++
			continue
		}

		// Claim before sending so overlapping runs or instances can't both send.
		claimed, err := h.service.claimCheckin(ctx, user.ID, nowUTC, loc, state.NextIgnoredInARow())
		if err != nil {
			slog.Error("Check-in: failed to claim", "user_id", user.ID, "error", err)
			continue
		}
		if !claimed {
			skipped[CheckinSkipTooSoon]++
			continue
		}

		title, body := CheckinMessage(*focus)
		notifications = append(notifications, xutils.Notification{
			Token:   user.PushToken,
			Title:   title,
			Message: body,
			Data: map[string]string{
				"type":       "checkin",
				"task_id":    focus.TaskID.Hex(),
				"categoryId": focus.CategoryID.Hex(),
				"reason":     string(focus.Kind),
				"url": fmt.Sprintf("/(logged-in)/(tabs)/(task)/task/%s?categoryId=%s&name=%s",
					focus.TaskID.Hex(), focus.CategoryID.Hex(), url.QueryEscape(focus.Content)),
			},
		})
	}

	if len(notifications) > 0 {
		if err := xutils.SendBatchNotification(notifications); err != nil {
			slog.Error("Error sending batch checkin notifications", "error", err)
			return fiber.Map{"error": err.Error(), "notifications_sent": 0}, err
		}
	}

	return fiber.Map{
		"message":            "Checkin notifications processed",
		"total_users":        len(users),
		"matched_users":      inSlot,
		"skipped":            skipped,
		"notifications_sent": len(notifications),
		"current_time":       nowUTC.Format("15:04"),
	}, nil
}

func checkinLocation(timezone string) *time.Location {
	if timezone == "" {
		return time.UTC
	}
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		return time.UTC
	}
	return loc
}

func latestTime(ts ...*time.Time) *time.Time {
	var latest *time.Time
	for _, t := range ts {
		if t != nil && (latest == nil || t.After(*latest)) {
			latest = t
		}
	}
	return latest
}

func (s *Service) usersColl() *mongo.Collection {
	return s.Tasks.Database().Collection("users")
}

// loadCheckinFacts reads the two personalization facts the check-in uses: the
// hour the user's peak window opens, and whether they should be nudged less.
// Missing facts are normal for new users and just mean "use the defaults".
func (s *Service) loadCheckinFacts(ctx context.Context, userID primitive.ObjectID) (peakStart *int, reduce bool) {
	cur, err := s.Tasks.Database().Collection(userMemoryCollection).Find(ctx, bson.M{
		"userId":     userID,
		"key":        bson.M{"$in": bson.A{"peak-hours", "nudge-receptivity"}},
		"confidence": bson.M{"$gte": 0.35}, // gemini.MinFactConfidence
	})
	if err != nil {
		slog.Warn("Check-in: failed to load user facts", "user_id", userID, "error", err)
		return nil, false
	}
	defer cur.Close(ctx)

	var facts []struct {
		Key      string `bson:"key"`
		Evidence struct {
			WindowStartHour       *int `bson:"windowStartHour"`
			ShouldReduceFrequency bool `bson:"shouldReduceFrequency"`
		} `bson:"evidence"`
	}
	if err := cur.All(ctx, &facts); err != nil {
		slog.Warn("Check-in: failed to decode user facts", "user_id", userID, "error", err)
		return nil, false
	}
	for _, f := range facts {
		switch f.Key {
		case "peak-hours":
			if h := f.Evidence.WindowStartHour; h != nil && *h >= 0 && *h <= 23 {
				peakStart = h
			}
		case "nudge-receptivity":
			reduce = f.Evidence.ShouldReduceFrequency
		}
	}
	return peakStart, reduce
}

// loadCheckinState reads the check-in's ledger off the user document.
func (s *Service) loadCheckinState(ctx context.Context, userID primitive.ObjectID) (CheckinState, error) {
	var doc struct {
		Checkin struct {
			LastSentAt    *time.Time `bson:"lastSentAt"`
			IgnoredInARow int        `bson:"ignoredInARow"`
		} `bson:"checkin"`
	}
	err := s.usersColl().FindOne(ctx, bson.M{"_id": userID},
		options.FindOne().SetProjection(bson.M{"checkin": 1})).Decode(&doc)
	if err != nil && !errors.Is(err, mongo.ErrNoDocuments) {
		return CheckinState{}, err
	}
	return CheckinState{LastSentAt: doc.Checkin.LastSentAt, IgnoredInARow: doc.Checkin.IgnoredInARow}, nil
}

// loadCheckinCandidates returns the user's open tasks, and the latest time any
// task was created or edited, which counts as being active.
func (s *Service) loadCheckinCandidates(ctx context.Context, userID primitive.ObjectID) ([]CheckinCandidate, *time.Time, error) {
	cur, err := s.Tasks.Aggregate(ctx, []bson.M{
		{"$match": bson.M{"user": userID}},
		{"$unwind": "$tasks"},
		{"$match": bson.M{"tasks.releasedAt": nil, "tasks.somedayAt": nil}},
		{"$project": bson.M{"tasks": 1}},
	})
	if err != nil {
		return nil, nil, err
	}
	defer cur.Close(ctx)

	var rows []struct {
		CategoryID primitive.ObjectID `bson:"_id"`
		Task       types.TaskDocument `bson:"tasks"`
	}
	if err := cur.All(ctx, &rows); err != nil {
		return nil, nil, err
	}
	candidates := make([]CheckinCandidate, 0, len(rows))
	var lastEdit *time.Time
	for _, r := range rows {
		candidates = append(candidates, CheckinCandidate{Task: r.Task, CategoryID: r.CategoryID})
		created, edited := r.Task.Timestamp, r.Task.LastEdited
		lastEdit = latestTime(lastEdit, &created, &edited)
	}
	return candidates, lastEdit, nil
}

// lastCompletionAt is when the user last completed a task or logged progress.
func (s *Service) lastCompletionAt(ctx context.Context, userID primitive.ObjectID) (*time.Time, error) {
	var doc struct {
		TimeCompleted time.Time `bson:"timeCompleted"`
	}
	err := s.CompletedTasks.FindOne(ctx, bson.M{"user": userID},
		options.FindOne().SetSort(bson.D{{Key: "timeCompleted", Value: -1}}).
			SetProjection(bson.M{"timeCompleted": 1})).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &doc.TimeCompleted, nil
}

// claimCheckin records a check-in as sent today, unless one already was. The
// check and the write are one conditional update, so only one sender wins.
func (s *Service) claimCheckin(ctx context.Context, userID primitive.ObjectID, now time.Time, loc *time.Location, ignoredInARow int) (bool, error) {
	today := localMidnight(now.In(loc)).UTC()
	res, err := s.usersColl().UpdateOne(ctx,
		bson.M{
			"_id": userID,
			"$or": bson.A{
				bson.M{"checkin.lastSentAt": nil},
				bson.M{"checkin.lastSentAt": bson.M{"$lt": today}},
			},
		},
		bson.M{"$set": bson.M{
			"checkin.lastSentAt":    now,
			"checkin.ignoredInARow": ignoredInARow,
		}},
	)
	if err != nil {
		return false, err
	}
	return res.ModifiedCount > 0, nil
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
		// Released tasks were let go on purpose and Someday tasks are undated;
		// neither ever counts as waiting
		{
			"$match": bson.M{"tasks.releasedAt": nil, "tasks.somedayAt": nil},
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

// GetOpenTaskCountForUser returns the count of tasks where startDate <= today and have no deadline
func (s *Service) GetOpenTaskCountForUser(userID primitive.ObjectID, loc *time.Location) (int, error) {
	ctx := context.Background()

	now := time.Now().In(loc)
	endOfDay := time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 999999999, loc).UTC()

	pipeline := []bson.M{
		{"$match": bson.M{"user": userID}},
		{"$unwind": "$tasks"},
		{"$match": bson.M{
			"tasks.startDate": bson.M{
				"$ne":  nil,
				"$lte": endOfDay,
			},
			"tasks.deadline":   nil,
			"tasks.startTime":  nil,
			"tasks.releasedAt": nil,
			"tasks.somedayAt":  nil,
		}},
		{"$count": "total"},
	}

	cursor, err := s.Tasks.Aggregate(ctx, pipeline)
	if err != nil {
		return 0, fmt.Errorf("failed to count open tasks: %w", err)
	}
	defer cursor.Close(ctx)

	var result struct {
		Total int `bson:"total"`
	}
	if cursor.Next(ctx) {
		if err := cursor.Decode(&result); err != nil {
			return 0, fmt.Errorf("failed to decode open task count: %w", err)
		}
	}

	return result.Total, nil
}

// GetUsersWithPushTokens retrieves all users that have push tokens for notifications
func (s *Service) GetUsersWithPushTokens() ([]types.User, error) {
	ctx := context.Background()
	return s.Users.GetUsersWithPushTokens(ctx)
}
