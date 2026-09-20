package task

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"reflect"
	"strings"
	"sync"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"github.com/abhikaboy/Kindred/xutils"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// InboxCategoryName is the display name of the per-user holding category that
// auto-categorized tasks land in until the background job files them.
const InboxCategoryName = "Inbox"

// defaultInboxWorkspace is only used when the user has no categories at all, so
// there's no existing workspace to put the Inbox in.
const defaultInboxWorkspace = "Personal"

// maxAutoCategorizeAttempts caps how many times a single task is classified.
// A task the model can't confidently place just stays in the Inbox — filing it
// somewhere arbitrary would be worse than leaving it where the user can see it.
const maxAutoCategorizeAttempts = 3

// autoCategorizeBatchSize bounds one cron pass, since each task costs a model
// call. At a one-minute cadence this drains a large backlog quickly enough.
const autoCategorizeBatchSize = 25

// autoCategorizeRunning keeps overlapping sweeps out of each other's way. The
// cron fires every minute but a batch of model calls can outlast that, and two
// sweeps picking up the same task would race on the move.
var autoCategorizeRunning sync.Mutex

// geminiConfigured reports whether the injected classifier is actually usable.
// The service arrives as an `any` holding a *gemini.GeminiService, so a missing
// service is a non-nil interface wrapping a nil pointer.
func geminiConfigured(service any) bool {
	if service == nil {
		return false
	}
	value := reflect.ValueOf(service)
	return value.Kind() != reflect.Ptr || !value.IsNil()
}

// PendingCategorization is one task awaiting classification, paired with the
// category it currently sits in.
type PendingCategorization struct {
	Task       TaskDocument
	CategoryID primitive.ObjectID
	UserID     primitive.ObjectID
}

// EnsureInboxCategory returns the user's Inbox category, creating it if needed.
// It is created in whichever workspace the user most recently touched, so the
// Inbox shows up somewhere familiar rather than in a workspace of its own.
func (s *Service) EnsureInboxCategory(ctx context.Context, userID primitive.ObjectID) (*types.CategoryDocument, error) {
	var inbox types.CategoryDocument
	err := s.Tasks.FindOne(ctx, bson.M{"user": userID, "isInbox": true}).Decode(&inbox)
	if err == nil {
		return &inbox, nil
	}
	if !errors.Is(err, mongo.ErrNoDocuments) {
		return nil, err
	}

	workspaceName := defaultInboxWorkspace
	var recent types.CategoryDocument
	recentErr := s.Tasks.FindOne(
		ctx,
		bson.M{"user": userID},
		options.FindOne().SetSort(bson.D{{Key: "lastEdited", Value: -1}}).SetProjection(bson.M{"workspaceName": 1}),
	).Decode(&recent)
	if recentErr == nil && recent.WorkspaceName != "" {
		workspaceName = recent.WorkspaceName
	}

	inbox = types.CategoryDocument{
		ID:            primitive.NewObjectID(),
		Name:          InboxCategoryName,
		WorkspaceName: workspaceName,
		User:          userID,
		Tasks:         []TaskDocument{},
		LastEdited:    xutils.NowUTC(),
		IsInbox:       true,
	}
	if _, err := s.Tasks.InsertOne(ctx, inbox); err != nil {
		return nil, err
	}

	slog.LogAttrs(ctx, slog.LevelInfo, "Created inbox category",
		slog.String("userID", userID.Hex()),
		slog.String("categoryID", inbox.ID.Hex()),
		slog.String("workspace", workspaceName))

	return &inbox, nil
}

// GetTasksAwaitingCategorization returns tasks flagged for auto-categorization
// that haven't exhausted their attempts, oldest first so nothing starves.
func (s *Service) GetTasksAwaitingCategorization(ctx context.Context, limit int) ([]PendingCategorization, error) {
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"tasks.autoCategorize": true}}},
		{{Key: "$unwind", Value: "$tasks"}},
		// $lt is type-bracketed, so it would skip tasks that have never been
		// attempted — those have no counter field at all.
		{{Key: "$match", Value: bson.M{
			"tasks.autoCategorize": true,
			"$or": bson.A{
				bson.M{"tasks.autoCategorizeAttempts": bson.M{"$exists": false}},
				bson.M{"tasks.autoCategorizeAttempts": bson.M{"$lt": maxAutoCategorizeAttempts}},
			},
		}}},
		{{Key: "$sort", Value: bson.D{{Key: "tasks.timestamp", Value: 1}}}},
		{{Key: "$limit", Value: limit}},
		{{Key: "$project", Value: bson.M{"task": "$tasks", "categoryID": "$_id", "userID": "$user"}}},
	}

	cursor, err := s.Tasks.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var docs []struct {
		Task       TaskDocument       `bson:"task"`
		CategoryID primitive.ObjectID `bson:"categoryID"`
		UserID     primitive.ObjectID `bson:"userID"`
	}
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, err
	}

	pending := make([]PendingCategorization, 0, len(docs))
	for _, doc := range docs {
		pending = append(pending, PendingCategorization{Task: doc.Task, CategoryID: doc.CategoryID, UserID: doc.UserID})
	}
	return pending, nil
}

// recordCategorizationAttempt bumps the attempt counter on a task that is still
// waiting, so a task the model can't place eventually stops being retried.
func (s *Service) recordCategorizationAttempt(ctx context.Context, taskID, categoryID primitive.ObjectID) error {
	_, err := s.Tasks.UpdateOne(
		ctx,
		bson.M{"_id": categoryID},
		bson.D{{Key: "$inc", Value: bson.D{{Key: "tasks.$[t].autoCategorizeAttempts", Value: 1}}}},
		getTaskArrayFilterOptions(taskID),
	)
	return handleMongoError(ctx, "record categorization attempt", err)
}

// clearAutoCategorize marks a task as filed: the pending flag and its attempt
// counter go away, and the placement is stamped so clients can surface it.
func (s *Service) clearAutoCategorize(ctx context.Context, taskID, categoryID primitive.ObjectID, placed bool) error {
	unset := bson.D{
		{Key: "tasks.$[t].autoCategorize", Value: ""},
		{Key: "tasks.$[t].autoCategorizeAttempts", Value: ""},
	}
	update := bson.D{{Key: "$unset", Value: unset}}
	if placed {
		update = append(update, bson.E{
			Key:   "$set",
			Value: bson.D{{Key: "tasks.$[t].autoCategorizedAt", Value: xutils.NowUTC()}},
		})
	}

	_, err := s.Tasks.UpdateOne(ctx, bson.M{"_id": categoryID}, update, getTaskArrayFilterOptions(taskID))
	return handleMongoError(ctx, "clear auto-categorize flag", err)
}

// categorizationText is what the classifier sees. The notes add useful signal
// ("email the landlord" vs "email the landlord about the Q3 audit"), but are
// capped so a long note doesn't crowd out the title.
func categorizationText(task TaskDocument) string {
	text := task.Content
	notes := strings.TrimSpace(task.Notes)
	if notes != "" {
		if len(notes) > 280 {
			notes = notes[:280]
		}
		text += "\n" + notes
	}
	return text
}

// RunAutoCategorization files one batch of Inbox tasks into real categories.
// Every failure is contained to a single task: the batch keeps going, and an
// unplaced task simply stays in the Inbox where the user can still see it.
func (h *Handler) RunAutoCategorization(ctx context.Context) (placed int, err error) {
	if !geminiConfigured(h.geminiService) {
		return 0, nil
	}

	pending, err := h.service.GetTasksAwaitingCategorization(ctx, autoCategorizeBatchSize)
	if err != nil {
		return 0, fmt.Errorf("failed to load tasks awaiting categorization: %w", err)
	}

	for _, item := range pending {
		if h.categorizeOne(ctx, item) {
			placed++
		}
	}

	return placed, nil
}

// categorizeOne classifies and moves a single task, reporting whether it was
// filed. It never returns an error: one bad task must not stop the batch.
func (h *Handler) categorizeOne(ctx context.Context, item PendingCategorization) bool {
	log := func(level slog.Level, msg string, attrs ...slog.Attr) {
		slog.LogAttrs(ctx, level, msg, append(attrs,
			slog.String("taskID", item.Task.ID.Hex()),
			slog.String("userID", item.UserID.Hex()))...)
	}

	suggestion, err := h.callGeminiSuggestFlow(ctx, item.UserID.Hex(), categorizationText(item.Task), "UTC")
	if err != nil {
		log(slog.LevelWarn, "Auto-categorization model call failed", slog.String("error", err.Error()))
		if attemptErr := h.service.recordCategorizationAttempt(ctx, item.Task.ID, item.CategoryID); attemptErr != nil {
			log(slog.LevelWarn, "Failed to record categorization attempt", slog.String("error", attemptErr.Error()))
		}
		return false
	}

	ownedCategoryIDs, err := h.userCategoryIDs(ctx, item.UserID)
	if err != nil {
		log(slog.LevelWarn, "Failed to load owned categories", slog.String("error", err.Error()))
		return false
	}

	// sanitizeTaskSuggestion drops any category the user doesn't own, so a
	// hallucinated id can never move a task somewhere real.
	clean := sanitizeTaskSuggestion(*suggestion, ownedCategoryIDs)
	target, ok := h.resolveCategorizationTarget(clean, item)
	if !ok {
		if attemptErr := h.service.recordCategorizationAttempt(ctx, item.Task.ID, item.CategoryID); attemptErr != nil {
			log(slog.LevelWarn, "Failed to record categorization attempt", slog.String("error", attemptErr.Error()))
		}
		return false
	}

	if _, err := h.service.MoveTask(item.UserID, item.CategoryID, item.Task.ID, target); err != nil {
		log(slog.LevelWarn, "Auto-categorization move failed", slog.String("error", err.Error()))
		return false
	}

	// The flag lives on the task, which now sits in the target category.
	if err := h.service.clearAutoCategorize(ctx, item.Task.ID, target, true); err != nil {
		log(slog.LevelWarn, "Failed to clear auto-categorize flag", slog.String("error", err.Error()))
	}

	log(slog.LevelInfo, "Auto-categorized task", slog.String("categoryID", target.Hex()))
	return true
}

// resolveCategorizationTarget turns a suggestion into a category to move into.
// Suggesting the Inbox itself counts as "no idea", so the task waits for a
// later pass rather than being marked as filed where it already is.
func (h *Handler) resolveCategorizationTarget(clean TaskFieldSuggestionLocal, item PendingCategorization) (primitive.ObjectID, bool) {
	if clean.CategoryID == nil {
		return primitive.NilObjectID, false
	}

	target, err := primitive.ObjectIDFromHex(*clean.CategoryID)
	if err != nil || target == item.CategoryID {
		return primitive.NilObjectID, false
	}

	return target, true
}

// AutoCategorizeSweep is the cron entry point. It logs its own outcome so the
// scheduler only has to call it.
func (h *Handler) AutoCategorizeSweep() {
	if !autoCategorizeRunning.TryLock() {
		slog.Debug("Auto-categorization sweep already running; skipping this tick")
		return
	}
	defer autoCategorizeRunning.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	placed, err := h.RunAutoCategorization(ctx)
	if err != nil {
		slog.Error("Auto-categorization sweep failed", "error", err)
		return
	}
	if placed > 0 {
		slog.Info("Auto-categorization sweep complete", "placed", placed)
	}
}
