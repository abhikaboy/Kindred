package task

import (
	"context"
	"log/slog"

	"github.com/abhikaboy/Kindred/internal/handlers/types"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

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
