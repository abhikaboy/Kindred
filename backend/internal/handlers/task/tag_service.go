package task

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// TaggerInfo carries the denormalized display fields of the user who tagged a task.
type TaggerInfo struct {
	ID             primitive.ObjectID `bson:"id" json:"id"`
	DisplayName    string             `bson:"display_name" json:"display_name"`
	Handle         string             `bson:"handle" json:"handle"`
	ProfilePicture string             `bson:"profile_picture" json:"profile_picture"`
}

// PendingTaggedTask carries everything the home banner and the Copy prefill
// need in one payload.
type PendingTaggedTask struct {
	TaskID         primitive.ObjectID `bson:"taskId" json:"taskId"`
	Content        string             `bson:"content" json:"content"`
	Value          float64            `bson:"value" json:"value"`
	Priority       int                `bson:"priority" json:"priority"`
	Recurring      bool               `bson:"recurring" json:"recurring"`
	RecurFrequency string             `bson:"recurFrequency,omitempty" json:"recurFrequency,omitempty"`
	RecurDetails   *RecurDetails      `bson:"recurDetails,omitempty" json:"recurDetails,omitempty"`
	Deadline       *time.Time         `bson:"deadline,omitempty" json:"deadline,omitempty"`
	Notes          string             `bson:"notes,omitempty" json:"notes,omitempty"`
	Checklist      []ChecklistItem    `bson:"checklist,omitempty" json:"checklist,omitempty"`
	Timestamp      time.Time          `bson:"timestamp" json:"timestamp"`
	Tagger         TaggerInfo         `bson:"tagger" json:"tagger"`
}

// BuildTaggedUsers resolves raw user IDs to denormalized pending tag entries.
// Invalid or unknown IDs are skipped rather than failing the whole create.
func (s *Service) BuildTaggedUsers(userIDs []string) ([]types.TaggedTaskUser, error) {
	ctx := context.Background()
	tagged := make([]types.TaggedTaskUser, 0, len(userIDs))
	seen := make(map[primitive.ObjectID]bool)

	for _, raw := range userIDs {
		id, err := primitive.ObjectIDFromHex(raw)
		if err != nil {
			slog.Warn("Skipping invalid tagged user ID", "id", raw)
			continue
		}
		if seen[id] {
			continue
		}
		user, err := s.Users.GetUserByID(ctx, id)
		if err != nil || user == nil {
			slog.Warn("Skipping unknown tagged user", "id", raw)
			continue
		}
		seen[id] = true
		tagged = append(tagged, types.TaggedTaskUser{
			ID:             user.ID,
			Handle:         user.Handle,
			DisplayName:    user.DisplayName,
			ProfilePicture: user.ProfilePicture,
			Status:         types.TagStatusPending,
		})
	}
	return tagged, nil
}

// UpdateTaskTags reconciles the task's tag list against the desired ID set.
// Entries that already responded (watching/copied/untagged) are never removed
// (removal-after-response is out of scope). Pending entries not in the new set
// are dropped. New IDs are added as pending. Returns the newly added entries so
// the handler can notify them. Mirrors the template when recurring.
func (s *Service) UpdateTaskTags(
	userID, categoryID, taskID primitive.ObjectID,
	taggedUserIDs []string,
) ([]types.TaggedTaskUser, error) {
	ctx := context.Background()

	if err := s.verifyCategoryOwnership(ctx, categoryID, userID); err != nil {
		return nil, err
	}
	task, err := s.findTaskInCategory(ctx, categoryID, taskID)
	if err != nil {
		return nil, err
	}

	desired := make(map[primitive.ObjectID]bool, len(taggedUserIDs))
	for _, raw := range taggedUserIDs {
		if id, err := primitive.ObjectIDFromHex(raw); err == nil {
			desired[id] = true
		}
	}

	next := make([]types.TaggedTaskUser, 0, len(taggedUserIDs))
	existing := make(map[primitive.ObjectID]bool)
	for _, tu := range task.TaggedUsers {
		// Responded entries always survive; pending survives only if still desired
		if tu.Status != types.TagStatusPending || desired[tu.ID] {
			next = append(next, tu)
			existing[tu.ID] = true
		}
	}

	newIDs := make([]string, 0)
	for _, raw := range taggedUserIDs {
		id, err := primitive.ObjectIDFromHex(raw)
		if err != nil || existing[id] {
			continue
		}
		newIDs = append(newIDs, raw)
	}
	added, err := s.BuildTaggedUsers(newIDs)
	if err != nil {
		return nil, err
	}
	next = append(next, added...)

	_, err = s.Tasks.UpdateOne(ctx,
		bson.M{"_id": categoryID, "tasks._id": taskID},
		bson.M{"$set": bson.M{"tasks.$[t].taggedUsers": next}},
		getTaskArrayFilterOptions(taskID),
	)
	if err != nil {
		return nil, err
	}

	if task.TemplateID != nil {
		if _, err := s.TemplateTasks.UpdateOne(ctx,
			bson.M{"_id": *task.TemplateID},
			bson.M{"$set": bson.M{"taggedUsers": next}},
		); err != nil {
			slog.Error("Failed to mirror tags to template", "templateID", task.TemplateID.Hex(), "error", err)
		}
	}

	return added, nil
}

// GetPendingTaggedTasks returns every task where userID is tagged with
// status pending, joined with the tagger's display info.
func (s *Service) GetPendingTaggedTasks(userID primitive.ObjectID) ([]PendingTaggedTask, error) {
	ctx := context.Background()
	elem := bson.M{"$elemMatch": bson.M{"id": userID, "status": types.TagStatusPending}}

	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"tasks.taggedUsers": elem}}},
		{{Key: "$unwind", Value: "$tasks"}},
		{{Key: "$match", Value: bson.M{"tasks.taggedUsers": elem}}},
		{{Key: "$lookup", Value: bson.M{
			"from": "users", "localField": "user", "foreignField": "_id", "as": "taggerDoc",
		}}},
		{{Key: "$unwind", Value: "$taggerDoc"}},
		{{Key: "$project", Value: bson.M{
			"taskId":         "$tasks._id",
			"content":        "$tasks.content",
			"value":          "$tasks.value",
			"priority":       "$tasks.priority",
			"recurring":      "$tasks.recurring",
			"recurFrequency": "$tasks.recurFrequency",
			"recurDetails":   "$tasks.recurDetails",
			"deadline":       "$tasks.deadline",
			"notes":          "$tasks.notes",
			"checklist":      "$tasks.checklist",
			"timestamp":      "$tasks.timestamp",
			"tagger": bson.M{
				"id":              "$taggerDoc._id",
				"display_name":    "$taggerDoc.display_name",
				"handle":          "$taggerDoc.handle",
				"profile_picture": "$taggerDoc.profile_picture",
			},
		}}},
		{{Key: "$sort", Value: bson.M{"timestamp": -1}}},
	}

	cursor, err := s.Tasks.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	results := make([]PendingTaggedTask, 0)
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}
	return results, nil
}

// RespondToTaskTag records the tagged user's response on the live task and
// mirrors it to the template so future recurrences inherit it. The nested
// array filter scopes the write to the responder's own entry, so a user can
// never modify someone else's tag state.
func (s *Service) RespondToTaskTag(taskID, responderID primitive.ObjectID, status types.TagStatus) error {
	if status != types.TagStatusWatching && status != types.TagStatusCopied && status != types.TagStatusUntagged {
		return fmt.Errorf("invalid tag status: %q", status)
	}
	ctx := context.Background()

	res, err := s.Tasks.UpdateOne(ctx,
		bson.M{"tasks._id": taskID},
		bson.M{"$set": bson.M{"tasks.$[t].taggedUsers.$[u].status": status}},
		options.Update().SetArrayFilters(options.ArrayFilters{
			Filters: bson.A{
				bson.M{"t._id": taskID},
				bson.M{"u.id": responderID},
			},
		}),
	)
	if err != nil {
		return err
	}
	if res.MatchedCount == 0 {
		return mongo.ErrNoDocuments
	}

	// Mirror to template (cross-user fetch: responder doesn't own the category)
	task, _ := s.lookupTaskAndOwner(taskID)
	if task != nil && task.TemplateID != nil {
		if _, err := s.TemplateTasks.UpdateOne(ctx,
			bson.M{"_id": *task.TemplateID},
			bson.M{"$set": bson.M{"taggedUsers.$[u].status": status}},
			options.Update().SetArrayFilters(options.ArrayFilters{
				Filters: bson.A{bson.M{"u.id": responderID}},
			}),
		); err != nil {
			slog.Error("Failed to mirror tag response to template", "templateID", task.TemplateID.Hex(), "error", err)
		}
	}
	return nil
}

// lookupTaskAndOwner fetches a task across all users' categories. Returns the
// task and its owner's ID (zero ID when not found).
func (s *Service) lookupTaskAndOwner(taskID primitive.ObjectID) (*TaskDocument, primitive.ObjectID) {
	ctx := context.Background()
	pipeline := append(
		[]bson.D{{{Key: "$match", Value: bson.M{"tasks._id": taskID}}}},
		getBaseTaskPipeline()...,
	)
	pipeline = append(pipeline, bson.D{{Key: "$match", Value: bson.M{"_id": taskID}}})
	cursor, err := s.Tasks.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, primitive.NilObjectID
	}
	defer cursor.Close(ctx)
	var tasks []TaskDocument
	if err := cursor.All(ctx, &tasks); err != nil || len(tasks) == 0 {
		return nil, primitive.NilObjectID
	}
	return &tasks[0], tasks[0].UserID
}
